import type { DataSource } from 'typeorm';
import type {
  CriteriosBusca,
  RepositorioProfissionais,
  ResultadoBusca,
} from '../../application/ports/repositorio-profissionais.js';
import type { Profissional } from '../../domain/entidades/profissional.js';
import { inserir, inserirOuAtualizar } from '../database/escrita.js';
import {
  deProfissional,
  paraProfissional,
  type ProfissionalCompletoRow,
} from '../database/mapeadores.js';
import {
  AvaliacaoSchema,
  CompetenciaSchema,
  DisponibilidadeSchema,
  ParticipacaoSchema,
  ProfissionalSchema,
} from '../database/schemas/profissional.schema.js';

const SELECIONAR_PROFISSIONAIS = `
SELECT p.*,
  COALESCE((SELECT json_agg(json_build_object('nome', c.nome, 'nivel', c.nivel) ORDER BY c.id)
    FROM competencia c WHERE c.profissional_id = p.id), '[]'::json) AS competencias,
  COALESCE((SELECT json_agg(json_build_object(
      'id', a.id, 'nota', a.nota, 'comentario', a.comentario, 'data', a.data,
      'produtor_id', a.produtor_id, 'projeto_id', a.projeto_id, 'papel', a.papel,
      'genero', a.genero, 'tipo_captacao', a.tipo_captacao) ORDER BY a.data, a.id)
    FROM avaliacao a WHERE a.profissional_id = p.id), '[]'::json) AS avaliacoes,
  COALESCE((SELECT json_agg(json_build_object(
      'projeto_id', h.projeto_id, 'titulo', h.titulo, 'papel', h.papel, 'genero', h.genero,
      'tipo_captacao', h.tipo_captacao, 'ano', h.ano) ORDER BY h.id)
    FROM participacao_projeto h WHERE h.profissional_id = p.id), '[]'::json) AS historico,
  COALESCE((SELECT json_agg(json_build_object('inicio', d.inicio, 'fim', d.fim) ORDER BY d.inicio)
    FROM disponibilidade d WHERE d.profissional_id = p.id), '[]'::json) AS disponibilidades
FROM profissional p`;

const TABELAS_FILHAS = ['competencia', 'avaliacao', 'participacao_projeto', 'disponibilidade'];

export class RepositorioProfissionaisTypeorm implements RepositorioProfissionais {
  constructor(private readonly dataSource: DataSource) {}

  async buscarCandidatos(criterios: CriteriosBusca): Promise<ResultadoBusca> {
    const linhas = await this.dataSource.query<ProfissionalCompletoRow[]>(
      `${SELECIONAR_PROFISSIONAIS}
       WHERE p.ativo
         AND p.especialidades && $1::text[]
         AND p.preco_minimo <= $2
         AND NOT (p.id = ANY($5::text[]))
         AND EXISTS (SELECT 1 FROM disponibilidade d
                     WHERE d.profissional_id = p.id AND d.inicio <= $3 AND d.fim >= $4)
       ORDER BY p.id`,
      [
        criterios.papeis,
        criterios.precoMinimoAte,
        criterios.periodo.inicio,
        criterios.periodo.fim,
        criterios.excluirIds ?? [],
      ],
    );
    return { profissionais: linhas.map(paraProfissional), parcial: false, avisos: [] };
  }

  async listarAtivos(): Promise<Profissional[]> {
    const linhas = await this.dataSource.query<ProfissionalCompletoRow[]>(
      `${SELECIONAR_PROFISSIONAIS} WHERE p.ativo ORDER BY p.id`,
    );
    return linhas.map(paraProfissional);
  }

  async obterPorIds(ids: readonly string[]): Promise<Map<string, Profissional>> {
    if (ids.length === 0) {
      return new Map();
    }
    const linhas = await this.dataSource.query<ProfissionalCompletoRow[]>(
      `${SELECIONAR_PROFISSIONAIS} WHERE p.id = ANY($1::text[])`,
      [[...new Set(ids)]],
    );
    return new Map(linhas.map((linha) => [linha.id, paraProfissional(linha)]));
  }

  async contarAtivos(): Promise<number> {
    const [linha] = await this.dataSource.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM profissional WHERE ativo',
    );
    return Number(linha?.total ?? 0);
  }

  async salvarTodos(profissionais: readonly Profissional[]): Promise<void> {
    if (profissionais.length === 0) {
      return;
    }
    const linhas = profissionais.map(deProfissional);
    const ids = linhas.map((linha) => linha.profissional.id);
    await this.dataSource.transaction(async (manager) => {
      for (const tabela of TABELAS_FILHAS) {
        await manager.query(`DELETE FROM ${tabela} WHERE profissional_id = ANY($1::text[])`, [ids]);
      }
      await inserirOuAtualizar(
        manager,
        ProfissionalSchema,
        linhas.map((linha) => linha.profissional),
        ['id'],
      );
      await inserir(
        manager,
        CompetenciaSchema,
        linhas.flatMap((linha) => linha.competencias),
      );
      await inserir(
        manager,
        AvaliacaoSchema,
        linhas.flatMap((linha) => linha.avaliacoes),
      );
      await inserir(
        manager,
        ParticipacaoSchema,
        linhas.flatMap((linha) => linha.historico),
      );
      await inserir(
        manager,
        DisponibilidadeSchema,
        linhas.flatMap((linha) => linha.disponibilidades),
      );
    });
  }
}
