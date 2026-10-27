/** โหลดแยก chunk เฉพาะโหมด cognito (โหมด dev ไม่ต้องโหลด Amplify) */
import { Amplify } from 'aws-amplify'
import { config } from '../config'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.userPoolId,
      userPoolClientId: config.userPoolClientId,
      loginWith: { email: true },
    },
  },
})

export * from 'aws-amplify/auth'
