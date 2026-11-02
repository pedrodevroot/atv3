import { naoEncontrado } from '../../../application/erros/erro-aplicacao.js';
import type {
  AdaptadorProfissional,
  CadastroInterno,
  CriteriosProfissional,
} from '../../../application/ports/adaptador-profissional.js';
import type { Avaliacao } from '../../../domain/entidades/avaliacao.js';
import { Profissional } from '../../../domain/entidades/profissional.js';
import { selecionarProfissionais } from '../../repositories/filtro-candidatos.js';
import { ehIdExterno } from './origem-profissional.js';

export class AdaptadorInterno implements AdaptadorProfissional {
  readonly provedor = 'interno';
  readonly externo = false;

  constructor(private readonly cadastro: CadastroInterno) {}

  async listarProfissionais(criterios: CriteriosProfissional = {}): Promise<Profissional[]> {
    const internos = (await this.cadastro.listarAtivos()).filter(({ id }) => !ehIdExterno(id));
    return selecionarProfissionais(internos, criterios);
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    const profissional = (await this.cadastro.obterPorIds([id])).get(id);
    if (!profissional) {
      throw naoEncontrado('Profissional', id);
    }
    return profissional;
  }

  async registrarAvaliacao(id: string, avaliacao: Avaliacao): Promise<void> {
    const atual = await this.detalharProfissional(id);
    await this.cadastro.salvarTodos([
      Profissional.criar({
        id: atual.id,
        nome: atual.nome,
        especialidades: [...atual.especialidades],
        competencias: atual.competencias,
        avaliacoes: [...atual.avaliacoes, avaliacao],
        historico: atual.historico,
        faixaPreco: atual.faixaPreco,
        disponibilidades: atual.disponibilidades,
        localizacao: atual.localizacao,
        ativo: atual.ativo,
      }),
    ]);
  }
}
