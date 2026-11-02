import { describe, expect, it } from 'vitest';
import { AuditoriaRecomendacao } from '../../../src/application/observers/auditoria-recomendacao.js';
import type { Observador } from '../../../src/application/ports/observador.js';
import { SistemaRecomendacao } from '../../../src/application/sistema-recomendacao.js';
import { criarCanaisSaida } from '../../../src/container.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import { BarramentoEventosEmMemoria } from '../../../src/infrastructure/messaging/barramento-eventos-memoria.js';
import { criarProjetoDemonstracao } from '../../fixtures/cadastro-demonstracao.js';
import { criarFabricas } from '../../fixtures/fabricas.js';
import { criarAmbienteOrquestracao, relogioFixo } from '../../fixtures/orquestracao.js';

function criarSistema() {
  const { repositorio, registro, parametros } = criarAmbienteOrquestracao();
  const barramento = new BarramentoEventosEmMemoria();
  const canais = criarCanaisSaida();
  const sistema = new SistemaRecomendacao({
    repositorio,
    fabricas: criarFabricas(canais.caixa),
    estrategias: registro,
    sujeito: barramento,
    parametros,
    relogio: relogioFixo,
  });
  return { sistema, barramento, registro, canais };
}

describe('SistemaRecomendacao (classe do diagrama)', () => {
  it('definirEstrategia troca o algoritmo e executarRecomendacao aplica a estratégia atual', async () => {
    const { sistema, registro } = criarSistema();
    const diretor = async () =>
      (await sistema.executarRecomendacao(criarProjetoDemonstracao())).equipes[0]?.membro(
        Papel.DIRETOR,
      )?.profissional.nome;

    expect(sistema.estrategia).toBeUndefined();
    expect(await diretor()).toBe('Helena Técnica');

    sistema.definirEstrategia('regras-orcamento');
    expect(await diretor()).toBe('Caio Local');

    sistema.definirEstrategia(registro.obter('filtragem-colaborativa'));
    expect(await diretor()).toBe('Marta Consagrada');
  });

  it('sem estratégia escolhida usa o recomendador fabricado para o tipo do projeto', async () => {
    const { sistema } = criarSistema();
    sistema.definirEstrategia('regras-orcamento');
    sistema.usarEstrategiaDoTipo();

    const resultado = await sistema.executarRecomendacao(
      criarProjetoDemonstracao('recomendador-ficcao'),
    );

    expect(sistema.estrategia).toBeUndefined();
    expect(resultado.estrategia).toBe('recomendador-ficcao');
    expect(resultado.equipes[0]?.membro(Papel.DIRETOR)?.profissional.nome).toBe('Helena Técnica');
  });

  it('notifica os observadores adicionados a cada recomendação gerada', async () => {
    const { sistema, barramento } = criarSistema();
    const canais = criarCanaisSaida();
    const auditoria = new AuditoriaRecomendacao(canais.auditoria);
    const recebidos: string[] = [];
    const contador: Observador = {
      nome: 'contador',
      interesses: '*',
      atualizar: (evento) => {
        recebidos.push(evento.tipo);
        return Promise.resolve();
      },
    };
    sistema.adicionarObservador(auditoria);
    sistema.adicionarObservador(contador);

    await sistema.executarRecomendacao(criarProjetoDemonstracao());
    await barramento.aguardarEntregas();
    sistema.removerObservador(contador);
    await sistema.executarRecomendacao(criarProjetoDemonstracao());
    await barramento.aguardarEntregas();

    expect(recebidos).toEqual(['RECOMENDACAO_GERADA']);
    expect(canais.auditoria.entradas.total).toBe(2);
  });

  it('recusa estratégia desconhecida', () => {
    const { sistema } = criarSistema();

    expect(() => {
      sistema.definirEstrategia('aleatoria');
    }).toThrow(expect.objectContaining({ codigo: 'ESTRATEGIA_DESCONHECIDA' }) as Error);
  });
});
