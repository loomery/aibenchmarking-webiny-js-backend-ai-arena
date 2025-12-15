## Prep

**Prerequisite:** Ensure that you have the AWS CLI configured on your machine with your AWS account (your project will need to be deployed to AWS)

This challenge can be tested on the framework project only (no need to create a new Webiny project) and tested via the Admin app accessible at `localhost:3001`

1. `yarn webiny deploy --env dev` then make a note of the domain from the 'Main GraphQL API' URL (everything before `/graphql`)
2. `yarn webiny watch admin --env=dev` then open the Admin app in the browser
3. Ensure that the app is initialised and ready to use with your user login
4. Access the API playground at `localhost:3001/api-playground`
5. Execute the following mutation via the 'Main API' (to ensure the file manager settings are configured correctly):
    ```
    mutation UpdateSettings {
       fileManager {
         updateSettings(data: {
           uploadMinFileSize: 0
           uploadMaxFileSize: 10737418240
           srcPrefix: "<domain from step 1>/files/"
         }) {
           data {
             uploadMinFileSize
             uploadMaxFileSize
             srcPrefix
           }
           error {
             message
             code
           }
         }
       }
     }
     ```