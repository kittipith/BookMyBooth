import { AuthError, type AuthAdapter } from './adapter'

const amplify = () => import('./amplify')

/** error ของ Amplify มีชื่อ exception ของ Cognito อยู่ใน name */
async function wrap<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    if (e instanceof Error) throw new AuthError(e.name, e.message)
    throw e
  }
}

export const cognitoAdapter: AuthAdapter = {
  mode: 'cognito',

  signUp: (email, password, role) =>
    wrap(async () => {
      const { signUp } = await amplify()
      await signUp({ username: email, password, options: { userAttributes: { email, 'custom:role': role } } })
    }),

  confirmSignUp: (email, code, profile) =>
    wrap(async () => {
      const { confirmSignUp } = await amplify()
      // Cognito รับ clientMetadata เป็น string ทั้งหมด
      const clientMetadata = Object.fromEntries(Object.entries(profile).filter(([, v]) => v).map(([k, v]) => [k, String(v)]))
      await confirmSignUp({ username: email, confirmationCode: code.trim(), options: { clientMetadata } })
    }),

  resendCode: (email) =>
    wrap(async () => {
      const { resendSignUpCode } = await amplify()
      await resendSignUpCode({ username: email })
    }),

  signIn: (email, password) =>
    wrap(async () => {
      const { signIn, signOut } = await amplify()
      // ล็อกอินค้างอยู่ (เช่น token เดิมของบัญชีอื่น) Amplify จะไม่ยอมล็อกอินซ้ำ
      await signOut()
      const { nextStep } = await signIn({ username: email, password })
      if (nextStep.signInStep === 'CONFIRM_SIGN_UP') return 'confirm_sign_up'
      if (nextStep.signInStep !== 'DONE') throw new AuthError('UnsupportedStep', `ยังไม่รองรับขั้นตอน ${nextStep.signInStep}`)
      return 'done'
    }),

  signOut: () =>
    wrap(async () => {
      const { signOut } = await amplify()
      await signOut()
    }),

  forgotPassword: (email) =>
    wrap(async () => {
      const { resetPassword } = await amplify()
      await resetPassword({ username: email })
    }),

  confirmForgotPassword: (email, code, newPassword) =>
    wrap(async () => {
      const { confirmResetPassword } = await amplify()
      await confirmResetPassword({ username: email, confirmationCode: code.trim(), newPassword })
    }),

  async getAccessToken() {
    try {
      const { fetchAuthSession } = await amplify()
      // Amplify ต่ออายุ access token เองเมื่อหมดอายุ (ใช้ refresh token)
      const session = await fetchAuthSession()
      return session.tokens?.accessToken?.toString() ?? null
    } catch {
      return null
    }
  },

  refreshSession: () =>
    wrap(async () => {
      const { fetchAuthSession } = await amplify()
      await fetchAuthSession({ forceRefresh: true })
    }),
}
