import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginSecurity from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import noUnsanitized from 'eslint-plugin-no-unsanitized';

export default tseslint.config(
  {
    ignores: [
      'dist/**/*',
      'node_modules/**/*',
      'coverage/**/*',
      'firebase-export-*/**/*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      security: pluginSecurity,
      sonarjs,
      'no-unsanitized': noUnsanitized,
    },
    rules: {
      ...pluginSecurity.configs.recommended.rules,
      ...sonarjs.configs.recommended.rules,
      ...noUnsanitized.configs.recommended.rules,

      // Override/relax overly restrictive rules for existing codebase
      'security/detect-object-injection': 'off',
      'security/detect-unsafe-regex': 'off',
      'sonarjs/pseudo-random': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/fixme-tag': 'off',
      'sonarjs/no-commented-code': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/public-static-readonly': 'off',
      'sonarjs/unused-import': 'off',
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/no-dead-store': 'off',
      'sonarjs/no-ignored-exceptions': 'off',
      'sonarjs/no-redundant-jump': 'off',
      'sonarjs/no-duplicated-branches': 'off',
      'sonarjs/class-name': 'off',
      'sonarjs/hashing': 'off',
      'sonarjs/slow-regex': 'off',
      'sonarjs/assertions-in-tests': 'off', // Node standard assert library is used

      // Unsanitized (relax for dynamic imports)
      'no-unsanitized/method': 'off',
      'no-unsanitized/property': 'off',

      // TypeScript rules relaxation
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',

      // General JS/TS quality rule adjustments
      'no-prototype-builtins': 'off',
      'prefer-const': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'preserve-caught-error': 'off',
      'no-useless-assignment': 'off',
    },
  }
);
