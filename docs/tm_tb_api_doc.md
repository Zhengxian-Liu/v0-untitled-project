# API Documentation: Localization Resource Matching Service

Version: 1.0

Last Updated: 2024-05-16

## Service Description
This service provides automated translation (AT) matching for given source text within a specified project. It queries localization resources (e.g., Translation Memory - TM) to find potential matches.
## Environments and Endpoints
1. Testing Environment (测试环境):
API Endpoint URL: https://devapi-takumi.mihoyo.com/localization/internalapi/at/resource/match  
Secret Key (secret): *miHuYouqTdx4O6mGk7Met*

2. Production Environment (正式环境):
API Endpoint URL: https://lms-api.office.mihoyo.com/localization/internalapi/at/resource/match  
Secret Key (secret): *miHuYouqTdx4O6mGk7Met4L*  
> Note: Ensure you are using the correct URL and secret key corresponding to the environment you are targeting. Access to these endpoints likely requires being on the company's internal network or an authorized VPN.

## Authentication
Authentication is handled via a custom signature scheme included in the request body.  
* timestamp: An integer representing the standard Unix timestamp (seconds since UTC epoch: 1970-01-01T00:00:00Z).  
* Validity: The request timestamp must be within 30 seconds (server-configurable) of the server's current UTC time upon receiving the request.
* secret: A project-specific secret key string. Use the appropriate secret key for the target environment and project (see "Environments and Endpoints" above). For project-specific secrets beyond the environment defaults, contact the LMS development team.
* sign: An MD5 hash string calculated as follows:  
    * Concatenate the secret key string and the string representation of the timestamp.  
        `string_to_hash = secret_key_as_string + timestamp_as_string`
    * Calculate the MD5 hash of string_to_hash.  
    `sign = MD5(string_to_hash)`  

    * The resulting sign should be a 32-character lowercase hexadecimal string.  
## Request Details
Method: POST

## Body (JSON)
The request body must be a JSON object with the following fields:
`{
    "dataId": "4052112",
    "project": "hk4e",
    "textId": "AchievementData",
    "srcText": "派萌",
    "srcLang": "CHS",
    "tarLang": "EN",
    "tmAssetIds": [1256],
    "sign": "GENERATED_MD5_SIGNATURE_STRING",
    "timestamp": CURRENT_UNIX_TIMESTAMP_INTEGER
}`

* dataId (String): Identifier for the specific data/text being processed.
* project (String): The project identifier (e.g., hk4e). Must align with the x-rpc-localization_project header and the secret used.
* textId (String): Category or type identifier of the text (e.g., AchievementData).
* srcText (String): The source text string to find matches for.
* srcLang (String): The language code of the source text (e.g., CHS for Simplified Chinese).
* tarLang (String): The target language code for translation (e.g., EN for English).
* tmAssetIds (Array<Integer>, Optional): Array of Translation Memory asset IDs that might be relevant. Can be an empty array [] or omitted if not applicable (API behavior for omission should be verified).
* sign (String): The 32-character lowercase MD5 signature.
* timestamp (Integer): The Unix timestamp (seconds since epoch UTC) used to generate the sign.
## Responses
### Successful Response (200 OK)  
* Content-Type: application/json
* Body (JSON):  
`{
    "retcode": 0,
    "message": "OK",
    "data": {
        "list": [
            {
                "type": "tm",
                "baseId": 1256,
                "id": "67610c74f61f1bde96b76b32",
                "srcLangContent": "卖萌",
                "destLangContent": "Being cute",
                "matchRate": 50
            }
            // ... more match objects if found
        ]
    }
}`
* retcode (Integer): 0 indicates success.
* message (String): "OK" for success, or a descriptive message.
* data.list (Array<Object>): A list of found matches. Each match object includes:
* type (String): Type of match (e.g., tm).
* baseId (Integer): An ID related to the source of the match.
* id (String): Unique identifier of the matched entry.
* srcLangContent (String): Source language content of the matched entry.
* destLangContent (String): Target language content of the matched entry.
* matchRate (Integer): Match percentage (0-100).
