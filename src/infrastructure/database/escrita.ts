import type { EntityManager, EntitySchema, ObjectLiteral } from 'typeorm';

const TAMANHO_LOTE = 1_000;

export function emLotes<T>(itens: readonly T[], tamanho = TAMANHO_LOTE): T[][] {
  const lotes: T[][] = [];
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    lotes.push(itens.slice(inicio, inicio + tamanho));
  }
  return lotes;
}

export async function inserir<T extends ObjectLiteral>(
  manager: EntityManager,
  schema: EntitySchema<T>,
  linhas: readonly T[],
): Promise<void> {
  for (const lote of emLotes(linhas)) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(schema)
      .values(lote)
      .updateEntity(false)
      .execute();
  }
}

export async function inserirOuAtualizar<T extends ObjectLiteral>(
  manager: EntityManager,
  schema: EntitySchema<T>,
  linhas: readonly T[],
  chaves: readonly (keyof T & string)[],
): Promise<void> {
  const [primeira] = linhas;
  if (!primeira) {
    return;
  }
  const colunasAtualizaveis = Object.keys(primeira).filter(
    (coluna) => !chaves.includes(coluna as keyof T & string),
  );
  for (const lote of emLotes(linhas)) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(schema)
      .values(lote)
      .orUpdate(colunasAtualizaveis, [...chaves])
      .updateEntity(false)
      .execute();
  }
}
