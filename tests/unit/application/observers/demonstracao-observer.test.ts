import { describe, expect, it } from 'vitest';
import { AuditoriaRecomendacao } from '../../../../src/application/observers/auditoria-recomendacao.js';
import { NotificadorEmail } from '../../../../src/application/observers/notificador-email.js';
import { NotificadorInterno } from '../../../../src/application/observers/notificador-interno.js';
import { PublicadorIntegracao } from '../../../../src/application/observers/publicador-integracao.js';
import type { Observador } from '../../../../src/application/ports/observador.js';
import { criarCanaisSaida } from '../../../../src/container.js';
import {
  BarramentoEventosEmMemoria,
  type FalhaObservador,
} from '../../../../src/infrastructure/messaging/barramento-eventos-memoria.js';
import { eventoEquipeFormada, eventoRecomendacao } from '../../../fixtures/eventos.js';

class ObservadorQuebrado implements Observador {
  readonly nome = 'observador-quebrado';
  readonly interesses = '*' as const;
  tentativas = 0;

  atualizar(): Promise<void> {
    this.tentativas += 1;
    return Promise.reject(new Error('serviço de SMS fora do ar'));
  }
}

class ObservadorLento implements Observador {
  readonly nome = 'observador-lento';
  readonly interesses = '*' as const;
  concluido = false;
  private liberar: () => void = () => undefined;

  atualizar(): Promise<void> {
    return new Promise((resolver) => {
      this.liberar = () => {
        this.concluido = true;
        resolver();
      };
    });
  }

  terminar(): void {
    this.liberar();
  }
}

function montarCenario() {
  const falhas: FalhaObservador[] = [];
  const barramento = new BarramentoEventosEmMemoria((falha) => falhas.push(falha));
  const canais = criarCanaisSaida();
  const quebrado = new ObservadorQuebrado();
  const observadores: Observador[] = [
    quebrado,
    new NotificadorEmail(canais.email),
    new NotificadorInterno(canais.caixa),
    new AuditoriaRecomendacao(canais.auditoria),
    new PublicadorIntegracao(canais.publicador),
  ];
  for (const observador of observadores) {
    barramento.adicionarObservador(observador);
  }
  return { barramento, canais, falhas, quebrado, observadores };
}

describe('Demonstração do Observer: observadores reagem de forma independente', () => {
  it('um observador falha e os outros continuam reagindo ao mesmo evento', async () => {
    const { barramento, canais, falhas, quebrado } = montarCenario();
    const evento = eventoRecomendacao();

    barramento.notificarObservadores(evento);
    await barramento.aguardarEntregas();

    expect(quebrado.tentativas).toBe(1);
    expect(falhas).toHaveLength(1);
    expect(falhas[0]).toMatchObject({ observador: 'observador-quebrado', evento });
    expect(canais.email.enviados.todos.map((email) => email.destinatarioId)).toEqual([
      'diretora',
      'editora',
    ]);
    expect(canais.caixa.mensagensDe('diretora')[0]?.assunto).toBe(
      'Um produtor tem interesse no seu perfil',
    );
    expect(canais.auditoria.entradas.todos[0]).toMatchObject({
      tipo: 'RECOMENDACAO_GERADA',
      atorId: 'produtor-1',
      tipoAtor: 'PRODUTOR',
    });
  });

  it('a falha não derruba o observador: ele continua inscrito e os outros seguem funcionando', async () => {
    const { barramento, canais, quebrado } = montarCenario();

    barramento.notificarObservadores(eventoRecomendacao());
    barramento.notificarObservadores(eventoEquipeFormada());
    await barramento.aguardarEntregas();

    expect(quebrado.tentativas).toBe(2);
    expect(canais.auditoria.entradas.total).toBe(2);
    expect(canais.publicador.publicadas.total).toBe(2);
  });

  it('cada observador reage apenas aos eventos do seu interesse', async () => {
    const { barramento, canais } = montarCenario();

    barramento.notificarObservadores(eventoRecomendacao());
    await barramento.aguardarEntregas();
    expect(canais.publicador.publicadas.total).toBe(0);

    barramento.notificarObservadores(eventoEquipeFormada());
    await barramento.aguardarEntregas();
    expect(canais.publicador.publicadas.todos.map((mensagem) => mensagem.topico)).toEqual([
      'gerenciamento-projetos.equipe-formada',
      'financeiro.equipe-formada',
    ]);
  });

  it('a entrega é assíncrona: quem publica não espera os observadores', async () => {
    const { barramento, canais } = montarCenario();

    barramento.notificarObservadores(eventoRecomendacao());

    expect(canais.email.enviados.total).toBe(0);
    expect(barramento.entregasPendentes).toBe(4);
    await barramento.aguardarEntregas();
    expect(canais.email.enviados.total).toBe(2);
    expect(barramento.entregasPendentes).toBe(0);
  });

  it('um observador lento não atrasa os demais', async () => {
    const { barramento, canais } = montarCenario();
    const lento = new ObservadorLento();
    barramento.adicionarObservador(lento);

    barramento.notificarObservadores(eventoRecomendacao());
    await new Promise((resolver) => setTimeout(resolver, 20));

    expect(canais.email.enviados.total).toBe(2);
    expect(canais.auditoria.entradas.total).toBe(1);
    expect(lento.concluido).toBe(false);

    lento.terminar();
    await barramento.aguardarEntregas();
    expect(lento.concluido).toBe(true);
  });

  it('observador removido deixa de receber eventos e os demais continuam', async () => {
    const { barramento, canais, observadores } = montarCenario();
    const [, email] = observadores;
    if (!email) {
      throw new Error('observador de e-mail ausente');
    }
    barramento.removerObservador(email);

    barramento.notificarObservadores(eventoRecomendacao());
    await barramento.aguardarEntregas();

    expect(canais.email.enviados.total).toBe(0);
    expect(canais.auditoria.entradas.total).toBe(1);
    expect(barramento.observadores).not.toContain('notificador-email');
  });
});
