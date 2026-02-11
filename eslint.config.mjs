import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextConfig from 'eslint-config-next/core-web-vitals';
import nextTsConfig from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['.next/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextConfig,
  ...nextTsConfig,
  eslintConfigPrettier,
);
