import type { DataSource, EntityManager } from 'typeorm';
import { conflitoConcorrencia } from '../../application/erros/erro-aplicacao.js';
import type { RegistroFabricas } from '../../application/familias/registro-fabricas.js';
import type { RepositorioProjetos } from '../../application/ports/repositorio-projetos.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import { inserir, inserirOuAtualizar } from '../database/escrita.js';
import { deProjeto, paraProjeto, type LinhasProjetoLidas } from '../database/mapeadores.js';
import {
  EquipeSchema,
  MembroEquipeSchema,
  ProjetoSchema,
  RequisitoPapelSchema,
  type ProjetoRow,
} from '../database/schemas/projeto.schema.js';
import type { RepositorioProfissionaisTypeorm } from './repositorio-profissionais-typeorm.js';

const VIOLACAO_UNICIDADE = '23505';

export class RepositorioProjetosTypeorm implements RepositorioProjetos {
  private readonly versoes = new WeakMap<Projeto, number>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly profissionais: RepositorioProfissionaisTypeorm,
    private readonly fabricas: RegistroFabricas,
  ) {}

  async obter(id: string): Promise<Projeto | undefined> {
    const [projeto] = await this.dataSource.query<
      (LinhasProjetoLidas['projeto'] & { versao: number })[]
    >('SELECT * FROM projeto WHERE id = $1', [id]);
    if (!projeto) {
      return undefined;
    }
    const [requisitos, equipes, membros] = await Promise.all([
      this.dataSource.query<LinhasProjetoLidas['requisitos']>(
        'SELECT * FROM requisito_papel WHERE projeto_id = $1',
        [id],
      ),
      this.dataSource.query<LinhasProjetoLidas['equipes']>(
        'SELECT * FROM equipe WHERE projeto_id = $1 ORDER BY ordem, criada_em, id',
        [id],
      ),
      this.dataSource.query<LinhasProjetoLidas['membros']>(
        `SELECT m.* FROM membro_equipe m
         JOIN equipe e ON e.id = m.equipe_id
         WHERE e.projeto_id = $1`,
        [id],
      ),
    ]);
    const profissionais = await this.profissionais.obterPorIds(
      membros.map((membro) => membro.profissional_id),
    );
    const reconstruido = paraProjeto(
      { projeto, requisitos, equipes, membros },
      profissionais,
      this.fabricas,
    );
    this.versoes.set(reconstruido, projeto.versao);
    return reconstruido;
  }

  async salvar(projeto: Projeto): Promise<void> {
    const linhas = deProjeto(projeto);
    const equipesIds = linhas.equipes.map((equipe) => equipe.id);
    const versaoLida = this.versoes.get(projeto);
    await this.dataSource.transaction(async (manager) => {
      if (versaoLida === undefined) {
        await this.inserirNovo(manager, linhas.projeto);
      } else {
        await this.atualizarVersao(manager, projeto, versaoLida);
      }
      await manager.query('DELETE FROM requisito_papel WHERE projeto_id = $1', [projeto.id]);
      await inserir(manager, RequisitoPapelSchema, linhas.requisitos);
      await inserirOuAtualizar(manager, EquipeSchema, linhas.equipes, ['id']);
      await manager.query('DELETE FROM membro_equipe WHERE equipe_id = ANY($1::text[])', [
        equipesIds,
      ]);
      await inserir(manager, MembroEquipeSchema, linhas.membros);
    });
    this.versoes.set(projeto, (versaoLida ?? -1) + 1);
  }

  private async inserirNovo(manager: EntityManager, linha: ProjetoRow): Promise<void> {
    try {
      await inserir(manager, ProjetoSchema, [linha]);
    } catch (erro) {
      if ((erro as { code?: unknown }).code === VIOLACAO_UNICIDADE) {
        throw conflitoConcorrencia('Projeto', linha.id);
      }
      throw erro;
    }
  }

  private async atualizarVersao(
    manager: EntityManager,
    projeto: Projeto,
    versaoLida: number,
  ): Promise<void> {
    const atualizados = await manager.query<{ versao: number }[]>(
      `WITH atualizado AS (
         UPDATE projeto
            SET orcamento = $3, data_entrega = $4, estrategia = $5, detalhes = $6::jsonb,
                versao = versao + 1
          WHERE id = $1 AND versao = $2
         RETURNING versao)
       SELECT versao FROM atualizado`,
      [
        projeto.id,
        versaoLida,
        projeto.orcamento,
        projeto.dataEntrega,
        projeto.estrategia,
        JSON.stringify(projeto.detalhes),
      ],
    );
    if (atualizados.length === 0) {
      throw conflitoConcorrencia('Projeto', projeto.id);
    }
  }
}
