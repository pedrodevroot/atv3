import type {
  AdaptadorProfissional,
  CriteriosProfissional,
} from '../../../application/ports/adaptador-profissional.js';
import { Avaliacao } from '../../../domain/entidades/avaliacao.js';
import { Competencia } from '../../../domain/entidades/competencia.js';
import { Profissional } from '../../../domain/entidades/profissional.js';
import { PAPEIS, Papel } from '../../../domain/enums/papel.js';
import { TipoCaptacao } from '../../../domain/enums/tipo-captacao.js';
import { FaixaPreco } from '../../../domain/value-objects/faixa-preco.js';
import { Intervalo } from '../../../domain/value-objects/intervalo.js';
import { Localizacao } from '../../../domain/value-objects/localizacao.js';
import type { ApiProfissionalExterna } from '../../externos/api-profissional-externa.js';
import type { PerfilIndeed } from '../../externos/perfis-simulados.js';
import { selecionarProfissionais } from '../../repositories/filtro-candidatos.js';
import { PREFIXO_INDEED } from './origem-profissional.js';

const NOTA_ESCALA_INDEED = 2;
const DATA_AVALIACAO_EXTERNA = new Date('2026-01-01T00:00:00.000Z');

export class AdaptadorIndeed implements AdaptadorProfissional {
  readonly provedor = 'indeed';
  readonly externo = true;

  constructor(private readonly api: ApiProfissionalExterna<PerfilIndeed>) {}

  async listarProfissionais(criterios: CriteriosProfissional = {}): Promise<Profissional[]> {
    const perfis = await this.api.buscarProfissionais(
      criterios.papeis ? { termos: criterios.papeis } : {},
    );
    return selecionarProfissionais(perfis.map(paraProfissional), criterios);
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    return paraProfissional(await this.api.obterPerfil(id.replace(PREFIXO_INDEED, '')));
  }

  registrarAvaliacao(id: string, avaliacao: Avaliacao): Promise<void> {
    return this.api.avaliarProfissional(
      id.replace(PREFIXO_INDEED, ''),
      avaliacao.nota * NOTA_ESCALA_INDEED,
    );
  }
}

function ehPapel(funcao: string): funcao is Papel {
  return (PAPEIS as readonly string[]).includes(funcao);
}

function paraProfissional(perfil: PerfilIndeed): Profissional {
  const id = `${PREFIXO_INDEED}${perfil.id}`;
  const especialidades = perfil.funcoes.filter(ehPapel);
  const [latitude, longitude] = perfil.coordenadas;
  return Profissional.criar({
    id,
    nome: perfil.nome,
    especialidades,
    competencias: Object.entries(perfil.curriculo).map(([nome, nota]) =>
      Competencia.criar(nome, Math.max(1, Math.round(nota / NOTA_ESCALA_INDEED))),
    ),
    avaliacoes: perfil.notas.map((nota, indice) =>
      Avaliacao.criar({
        id: `${id}:avaliacao:${indice}`,
        nota: Math.max(1, nota / NOTA_ESCALA_INDEED),
        data: DATA_AVALIACAO_EXTERNA,
        produtorId: 'indeed',
        projetoId: 'historico-indeed',
        papel: especialidades[0] ?? Papel.EDITOR,
        genero: 'nao-informado',
        tipoCaptacao: TipoCaptacao.FICCAO,
      }),
    ),
    faixaPreco: FaixaPreco.criar(perfil.salarioCentavos.de / 100, perfil.salarioCentavos.ate / 100),
    disponibilidades: perfil.disponivel.map((periodo) =>
      Intervalo.criar(new Date(periodo.inicio), new Date(periodo.fim)),
    ),
    localizacao: Localizacao.criar({
      cidade: perfil.municipio,
      uf: perfil.uf,
      latitude,
      longitude,
    }),
  });
}
