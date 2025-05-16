# tm_tb_client.py

import hashlib
import time
import json
import requests # Using 'requests' for a synchronous environment
import logging # Added for logging

# Initialize logger for this module
logger = logging.getLogger(__name__)

# --- Custom Exceptions ---
class TMTBServiceError(Exception):
    """Base exception for TM/TB service errors."""
    pass

class TMTBAPIError(TMTBServiceError):
    """Raised when the API returns a non-zero retcode."""
    def __init__(self, message, retcode, api_message=""):
        super().__init__(f"TM/TB API Error (retcode {retcode}): {message}. API message: {api_message}")
        self.retcode = retcode
        self.api_message = api_message

class TMTBRequestError(TMTBServiceError):
    """Raised for network or HTTP errors during API request."""
    def __init__(self, status_code, reason, response_text=None):
        super().__init__(f"TM/TB API Request Failed: {status_code} {reason}. Response: {response_text[:200] if response_text else 'N/A'}")
        self.status_code = status_code
        self.reason = reason
        self.response_text = response_text


class TMTBClient:
    def __init__(self, base_url: str, secret_key: str, default_project: str = None, request_timeout: int = 30):
        """
        Initializes the TM/TB API client.

        Args:
            base_url (str): The base URL for the TM/TB API endpoint.
            secret_key (str): The secret key for generating the signature.
            default_project (str, optional): Default project identifier to use if not specified in match_resources.
            request_timeout (int, optional): Timeout in seconds for API requests. Defaults to 30.
        """
        if not base_url or not secret_key:
            raise ValueError("base_url and secret_key are required.")
        self.base_url = base_url
        self.secret_key = secret_key
        self.default_project = default_project
        self.request_timeout = request_timeout
        self.session = requests.Session()

    def _generate_signature(self, timestamp: int) -> str:
        """
        Generates the MD5 signature for authentication.
        Signature = MD5(secret_key + timestamp_as_string)
        """
        string_to_hash = self.secret_key + str(timestamp)
        return hashlib.md5(string_to_hash.encode('utf-8')).hexdigest().lower()

    def match_resources(self,
                        data_id: str,
                        src_text: str,
                        src_lang: str,
                        tar_lang: str,
                        project: str,
                        text_id: str,
                        tm_asset_ids: list[int] = None) -> list[dict]:
        """
        Calls the TM/TB matching service.

        Args:
            data_id (str): Identifier for the data/text.
            src_text (str): The source text to match.
            src_lang (str): Source language code (e.g., "CHS").
            tar_lang (str): Target language code (e.g., "EN").
            project (str): Project identifier (e.g., "hk4e").
            text_id (str): Category/type identifier for the text.
            tm_asset_ids (list[int], optional): Array of TM asset IDs. Defaults to None, resulting in an empty list in the payload.

        Returns:
            list[dict]: A list of match objects from the API response.
                        Example: [{"type": "tm", "baseId": 123, "id": "...", "srcLangContent": "...", ...}]

        Raises:
            TMTBAPIError: If the API returns an error retcode.
            TMTBRequestError: If there's an issue with the HTTP request itself.
            ValueError: If required parameters like 'project' are missing and no default is set, or other essential args are missing.
        """
        current_project = project
        if not current_project:
            raise ValueError("Project identifier is required.")
        if not all([data_id, src_text, src_lang, tar_lang, text_id, project]):
            raise ValueError("data_id, src_text, src_lang, tar_lang, project, and text_id are required.")

        timestamp = int(time.time())
        sign = self._generate_signature(timestamp)

        payload = {
            "dataId": data_id,
            "project": current_project,
            "textId": text_id,
            "srcText": src_text,
            "srcLang": src_lang,
            "tarLang": tar_lang,
            "sign": sign,
            "timestamp": timestamp
        }

        headers = {"Content-Type": "application/json"}

        # Log the payload before sending
        logger.debug(f"TM/TB Request URL: {self.base_url}")
        logger.debug(f"TM/TB Request Headers: {headers}")
        logger.debug(f"TM/TB Request Payload: {json.dumps(payload, ensure_ascii=False, indent=2)}") # Log payload as formatted JSON

        try:
            response = self.session.post(self.base_url, headers=headers, json=payload, timeout=self.request_timeout)
            response.raise_for_status() 
        except requests.exceptions.Timeout as e:
            raise TMTBRequestError(status_code=None, reason=f"Request timed out after {self.request_timeout}s: {e}", response_text=None) from e
        except requests.exceptions.HTTPError as e: # Handles 4xx/5xx errors
             raise TMTBRequestError(status_code=e.response.status_code, reason=e.response.reason, response_text=e.response.text) from e
        except requests.exceptions.RequestException as e: 
            response_text = e.response.text if hasattr(e, 'response') and e.response is not None else None
            status_code = e.response.status_code if hasattr(e, 'response') and e.response is not None else None
            reason = str(e) # General reason
            raise TMTBRequestError(status_code=status_code, reason=reason, response_text=response_text) from e

        try:
            response_json = response.json()
        except json.JSONDecodeError as e:
            raise TMTBRequestError(status_code=response.status_code, reason="Failed to decode JSON response", response_text=response.text) from e

        retcode = response_json.get("retcode")
        message = response_json.get("message", "")

        if retcode == 0:
            return response_json.get("data", {}).get("list", [])
        else:
            # Consider logging the full error response here for debugging
            # e.g., logger.error(f"TM/TB API Error: retcode={retcode}, message='{message}', data='{response_json.get('data')}'")
            raise TMTBAPIError(message="API indicated failure", retcode=retcode, api_message=message)

    def close(self):
        """Closes the underlying HTTP session. Call this when the client is no longer needed."""
        self.session.close()

# Example placeholder for how configuration might be loaded (outside the class)
# This part would be adapted to your project's specific configuration strategy.
#
# import os
#
# def get_tm_tb_client_from_env():
#     api_url = os.getenv("TM_TB_API_URL")
#     api_secret = os.getenv("TM_TB_API_SECRET")
#     default_project = os.getenv("TM_TB_DEFAULT_PROJECT", "hk4e") # Example default
#
#     if not api_url or not api_secret:
#         raise EnvironmentError("TM_TB_API_URL and TM_TB_API_SECRET environment variables must be set.")
#
#     return TMTBClient(base_url=api_url, secret_key=api_secret, default_project=default_project)

# Basic usage example (can be removed or kept for testing)
# if __name__ == "__main__":
#     print("Attempting to use TMTBClient (ensure environment variables are set for a real test).")
#     # This example assumes you have set:
#     # TM_TB_API_URL="https://devapi-takumi.mihoyo.com/localization/internalapi/at/resource/match"
#     # TM_TB_API_SECRET="miHuYouqTdx4O6mGk7Met" (Test secret from docs)
#     # TM_TB_DEFAULT_PROJECT="hk4e"
#     try:
#         # client = get_tm_tb_client_from_env() # Using the hypothetical config loader
#         # For a direct test (if you don't want to set env vars for this quick test):
#         client = TMTBClient(
#             base_url="https://devapi-takumi.mihoyo.com/localization/internalapi/at/resource/match",
#             secret_key="miHuYouqTdx4O6mGk7Met", # Using the test secret from the documentation
#             default_project="hk4e"
#         )
#         print(f"Client initialized for project: {client.default_project}")
#
#         matches = client.match_resources(
#             data_id="example_data_id_002",
#             src_text="派蒙",
#             src_lang="CHS",
#             tar_lang="EN",
#             text_id="UI_Text", # Example text_id
#             project="hk4e"
#             # tm_asset_ids=[1256] # Optional
#         )
#         print("\nFound matches:")
#         if matches:
#             for match in matches:
#                 print(f"  - Type: {match.get('type')}, Src: '{match.get('srcLangContent')}', "
#                       f"Dest: '{match.get('destLangContent')}', Rate: {match.get('matchRate')}%")
#         else:
#             print("  No matches found or an empty list was returned.")
#
#     except TMTBServiceError as e:
#         print(f"\nError calling TM/TB Service: {e}")
#     except EnvironmentError as e:
#         print(f"\nConfiguration Error: {e}")
#     except Exception as e:
#         print(f"\nAn unexpected error occurred: {e}")
#     finally:
#         if 'client' in locals() and client:
#             client.close()
#             print("\nClient session closed.") 