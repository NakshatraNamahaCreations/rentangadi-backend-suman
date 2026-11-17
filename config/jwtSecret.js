require("dotenv").config();

/**
 * The key every token this API issues is signed with.
 *
 * It used to be written here in the clear. That is worse than it sounds: the
 * value is in the repository, so anyone holding a copy could sign themselves
 * an admin token, and a guard on the routes would have stopped none of them.
 * It now comes from the environment.
 *
 * The old literal stays as a fallback on purpose. Dropping it outright would
 * have signed out everyone the moment this deployed and, worse, left the API
 * unable to verify a single existing token - so the switch is made by setting
 * JWT_SECRET, not by this file, and the process says plainly at boot which of
 * the two it is using.
 *
 * Setting JWT_SECRET also rotates: every token signed with the old value stops
 * verifying, which is the point, and everyone signs in once more.
 */
const COMPROMISED_FALLBACK = "RENT_angadi123";

const JWT_SECRET_KEY = process.env.JWT_SECRET || COMPROMISED_FALLBACK;

if (!process.env.JWT_SECRET) {
  console.warn(
    "[auth] JWT_SECRET is not set - falling back to the key committed to the " +
      "repository, which anyone with the source can sign admin tokens with. " +
      "Set JWT_SECRET in .env to a long random value and restart."
  );
} else if (process.env.JWT_SECRET === COMPROMISED_FALLBACK) {
  console.warn(
    "[auth] JWT_SECRET is set to the value that was committed to the " +
      "repository. Change it to a long random value and restart."
  );
}

module.exports = JWT_SECRET_KEY;
