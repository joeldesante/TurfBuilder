declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BASE_URL_ARRAY: string;
			BETTER_AUTH_SECRET: string;
			BETTER_AUTH_URL: string;
			DATABASE_URL: string;
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}