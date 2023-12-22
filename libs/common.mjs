import { Users } from './db.mjs';

/**
 * Checks CSRF protection using custom header `X-Requested-With`
 **/
function csrfCheck(req, res, next) {
  if (req.header('X-Requested-With') != 'XMLHttpRequest') {
    return res.status(400).json({ error: 'invalid access.' });
  }
  next();
};

/**
 * Checks session cookie.
 * If the session does not contain `signed-in` or a username, consider the user is not signed in.
 * If the user is signed in, put the user object in `res.locals.user`.
 **/
async function sessionCheck(req, res, next) {
  if (!req.session['signed-in'] || !req.session.username) {
    return res.status(401).json({ error: 'not signed in.' });
  }
  const user = await Users.findByUsername(req.session.username);
  if (!user) {
    return res.status(401).json({ error: 'user not found.' });    
  }
  res.locals.user = user;
  next();
};

export { csrfCheck, sessionCheck };
