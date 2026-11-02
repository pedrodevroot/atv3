import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const semComentarios = {
  meta: {
    type: 'suggestion',
    messages: { proibido: 'Comentários não são permitidos no código; documente no README/docs.' },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comentario of context.sourceCode.getAllComments()) {
          context.report({ loc: comentario.loc, messageId: 'proibido' });
        }
      },
    };
  },
};

export default defineConfig(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    plugins: { cinebridge: { rules: { 'sem-comentarios': semComentarios } } },
    rules: {
      'cinebridge/sem-comentarios': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
