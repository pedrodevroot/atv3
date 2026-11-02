import type {
  AdaptadorProfissional,
  CriteriosProfissional,
} from '../../../application/ports/adaptador-profissional.js';
import { Avaliacao } from '../../../domain/entidades/avaliacao.js';
import { Competencia } from '../../../domain/entidades/competencia.js';
import { Profissional } from '../../../domain/entidades/profissional.js';
import { Papel } from '../../../domain/enums/papel.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import { FaixaPreco } from '../../../domain/value-objects/faixa-preco.js';
import { Intervalo } from '../../../domain/value-objects/intervalo.js';
import { Localizacao } from '../../../domain/value-objects/localizacao.js';
import type { ApiProfissionalExterna } from '../../externos/api-profissional-externa.js';
import { CARGOS_LINKEDIN, type PerfilLinkedIn } from '../../externos/perfis-simulados.js';
import { selecionarProfissionais } from '../../repositories/filtro-candidatos.js';
import { PREFIXO_LINKEDIN } from './origem-profissional.js';

const URN_MEMBRO = 'urn:li:member:';
const ENDOSSOS_POR_NIVEL = 20;
const DATA_AVALIACAO_EXTERNA = new Date('2026-01-01T00:00:00.000Z');

export class AdaptadorLinkedIn implements AdaptadorProfissional {
  readonly provedor = 'linkedin';
  readonly externo = true;

  constructor(private readonly api: ApiProfissionalExterna<PerfilLinkedIn>) {}

  async listarProfissionais(criterios: CriteriosProfissional = {}): Promise<Profissional[]> {
    const perfis = await this.api.buscarProfissionais(
      criterios.papeis ? { termos: cargosDe(criterios.papeis) } : {},
    );
    return selecionarProfissionais(perfis.map(paraProfissional), criterios);
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    return paraProfissional(await this.api.obterPerfil(urnDe(id)));
  }

  registrarAvaliacao(id: string, avaliacao: Avaliacao): Promise<void> {
    return this.api.avaliarProfissional(urnDe(id), avaliacao.nota);
  }
}

function cargosDe(papeis: readonly Papel[]): string[] {
  return Object.entries(CARGOS_LINKEDIN)
    .filter(([, papel]) => papeis.includes(papel))
    .map(([cargo]) => cargo);
}

function urnDe(id: string): string {
  return `${URN_MEMBRO}${id.replace(PREFIXO_LINKEDIN, '')}`;
}

function nivelDeEndossos(endossos: number): number {
  return Math.min(5, Math.max(1, Math.ceil(endossos / ENDOSSOS_POR_NIVEL)));
}

function paraProfissional(perfil: PerfilLinkedIn): Profissional {
  const papel = CARGOS_LINKEDIN[perfil.cargo] ?? Papel.EDITOR;
  const id = `${PREFIXO_LINKEDIN}${perfil.id.replace(URN_MEMBRO, '')}`;
  return Profissional.criar({
    id,
    nome: perfil.nomeCompleto,
    especialidades: [papel],
    competencias: perfil.habilidades.map((habilidade) =>
      Competencia.criar(habilidade.nome, nivelDeEndossos(habilidade.endossos)),
    ),
    avaliacoes: perfil.notas.map((nota, indice) =>
      Avaliacao.criar({
        id: `${id}:avaliacao:${indice}`,
        nota,
        data: DATA_AVALIACAO_EXTERNA,
        produtorId: 'linkedin',
        projetoId: 'historico-linkedin',
        papel,
        genero: 'nao-informado',
        tipoCaptacao: TipoCaptacao.FICCAO,
      }),
    ),
    faixaPreco: FaixaPreco.criar(perfil.pretensao.minimo, perfil.pretensao.maximo),
    disponibilidades: perfil.agenda.map((periodo) =>
      Intervalo.criar(new Date(periodo.de), new Date(periodo.ate)),
    ),
    localizacao: Localizacao.criar({
      cidade: perfil.localidade.cidade,
      uf: perfil.localidade.estado,
      latitude: perfil.localidade.latitude,
      longitude: perfil.localidade.longitude,
    }),
  });
}
