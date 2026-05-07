type Env = Record<string, string | undefined>;

export function validateEnv(config: Env) {
  const required = ['DATABASE_URL'];

  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return config;
}
