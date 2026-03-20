export const AUTH_COOKIE_NAME = 'fm_auth';

export function getAuthUser() {
  return process.env.FM_LOGIN_USER || 'admin';
}

export function getAuthPass() {
  return process.env.FM_LOGIN_PASS || 'admin';
}

export function getAuthToken() {
  return process.env.FM_AUTH_TOKEN || 'fm_session';
}

export function isValidCredentials(username: string, password: string) {
  return username === getAuthUser() && password === getAuthPass();
}
