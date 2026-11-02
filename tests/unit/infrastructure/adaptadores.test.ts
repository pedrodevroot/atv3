import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CadastroViaAdaptador } from '../../../src/application/cadastro-via-adaptador.js';
import { prefixoArquivosDoProjeto } from '../../../src/application/ports/adaptador-armazenamento.js';
import { StatusPagamento } from '../../../src/application/ports/adaptador-pagamento.js';
import { Papel, PAPEIS } from '../../../src/domain/enums/papel.js';
import { Intervalo } from '../../../src/domain/value-objects/intervalo.js';
import { AdaptadorLocal } from '../../../src/infrastructure/adaptadores/armazenamento/adaptador-local.js';
import {
  criarAdaptadorArmazenamento,
  criarAdaptadorPagamento,
  criarAdaptadorProfissional,
} from '../../../src/infrastructure/adaptadores/criar-adaptadores.js';
import { PERFIL_PAGSEGURO } from '../../../src/infrastructure/adaptadores/pagamento/adaptador-pagseguro.js';
import { PERFIL_PAYPAL } from '../../../src/infrastructure/adaptadores/pagamento/adaptador-paypal.js';
import {
  AdaptadorStripe,
  PERFIL_STRIPE,
} from '../../../src/infrastructure/adaptadores/pagamento/adaptador-stripe.js';
import { FonteCadastroAdaptada } from '../../../src/infrastructure/adaptadores/profissional/fonte-cadastro-adaptada.js';
import { DepositoObjetosMemoria } from '../../../src/infrastructure/externos/armazenamento-externo.js';
import { ArmazenamentoExterno } from '../../../src/infrastructure/externos/armazenamento-externo.js';
import { ErroSistemaExterno } from '../../../src/infrastructure/externos/erro-sistema-externo.js';
import {
  GatewayPagamento,
  LivroTransacoesMemoria,
} from '../../../src/infrastructure/externos/gateway-pagamento.js';
import { RepositorioProfissionaisMemoria } from '../../../src/infrastructure/repositories/repositorio-profissionais-memoria.js';
import { criarAvaliacao, criarProfissional } from '../../fixtures/dominio.js';

const diretorio = mkdtempSync(join(tmpdir(), 'cinebridge-local-'));

afterAll(() => {
  rmSync(diretorio, { recursive: true, force: true });
});

const METADADOS = { projetoId: 'projeto-1', nome: 'roteiro final.pdf', tipoConteudo: 'text/plain' };
const PREFIXO = prefixoArquivosDoProjeto('projeto-1');

describe.each([
  ['s3', 's3://cinebridge-midia/'],
  ['google-cloud', 'gs://cinebridge-midia/'],
  ['local', 'local://'],
] as const)('Adaptador de armazenamento %s', (provedor, uriBase) => {
  const criar = () =>
    criarAdaptadorArmazenamento(
      provedor,
      new DepositoObjetosMemoria(),
      mkdtempSync(join(diretorio, 'caso-')),
    );

  it('salva, lista e recupera pelo contrato padronizado', async () => {
    const adaptador = criar();

    const id = await adaptador.salvarArquivo(Buffer.from('conteúdo'), METADADOS);

    expect(adaptador.provedor).toBe(provedor);
    expect(id.startsWith(`${uriBase}${PREFIXO}`)).toBe(true);
    expect(id.endsWith('roteiro_final.pdf')).toBe(true);
    expect(await adaptador.listarArquivos(PREFIXO)).toEqual([id]);
    expect((await adaptador.recuperarArquivo(id)).toString()).toBe('conteúdo');
  });

  it('não lista arquivos de outro projeto', async () => {
    const adaptador = criar();

    await adaptador.salvarArquivo(Buffer.from('a'), { ...METADADOS, projetoId: 'projeto-2' });

    expect(await adaptador.listarArquivos(PREFIXO)).toEqual([]);
  });

  it('recusa um id que pertence a outro provedor', async () => {
    await expect(criar().recuperarArquivo('ftp://x/y')).rejects.toThrow(
      `não pertence ao provedor ${provedor}`,
    );
  });
});

describe('AdaptadorLocal', () => {
  it('não sai do diretório configurado', async () => {
    const adaptador = new AdaptadorLocal(mkdtempSync(join(diretorio, 'caso-')));

    await expect(adaptador.recuperarArquivo('local://../../segredo.txt')).rejects.toThrow(
      'fora do diretório',
    );
  });
});

describe('ArmazenamentoExterno', () => {
  it('imita o erro da API real para objeto inexistente', async () => {
    const externo = new ArmazenamentoExterno('s3', new DepositoObjetosMemoria());

    await expect(externo.download('nada')).rejects.toBeInstanceOf(ErroSistemaExterno);
  });

  it('isola os objetos de cada sistema no mesmo depósito', async () => {
    const deposito = new DepositoObjetosMemoria();
    const s3 = criarAdaptadorArmazenamento('s3', deposito, '');
    const google = criarAdaptadorArmazenamento('google-cloud', deposito, '');

    await s3.salvarArquivo(Buffer.from('a'), METADADOS);

    expect(await google.listarArquivos(PREFIXO)).toEqual([]);
  });
});

describe.each([
  ['stripe', PERFIL_STRIPE, 1_234_567],
  ['pagseguro', PERFIL_PAGSEGURO, 12_345.67],
  ['paypal', PERFIL_PAYPAL, 12_345.67],
] as const)('Adaptador de pagamento %s', (provedor, perfil, valorNoSistema) => {
  it('traduz valor, ids e status do sistema para o contrato padronizado', async () => {
    const livro = new LivroTransacoesMemoria();
    const adaptador = criarAdaptadorPagamento(provedor, livro);

    const id = await adaptador.efetuarPagamento(12_345.67, 'produtor', 'profissional');
    const transacao = await livro.obter(perfil.sistema, id);

    expect(adaptador.provedor).toBe(provedor);
    expect(id.startsWith(perfil.prefixoId)).toBe(true);
    expect(transacao?.valor).toBe(valorNoSistema);
    expect(transacao?.status).toBe(perfil.statusAprovado);
    expect(transacao?.dados).toMatchObject({ pagador: 'produtor', recebedor: 'profissional' });
    expect(await adaptador.verificarPagamento(id)).toBe(StatusPagamento.APROVADO);
  });

  it('cancela uma única vez', async () => {
    const adaptador = criarAdaptadorPagamento(provedor, new LivroTransacoesMemoria());
    const id = await adaptador.efetuarPagamento(100, 'produtor', 'profissional');

    expect(await adaptador.cancelarPagamento(id)).toBe(true);
    expect(await adaptador.cancelarPagamento(id)).toBe(false);
    expect(await adaptador.verificarPagamento(id)).toBe(StatusPagamento.CANCELADO);
  });

  it('não cancela um pagamento inexistente', async () => {
    const adaptador = criarAdaptadorPagamento(provedor, new LivroTransacoesMemoria());

    expect(await adaptador.cancelarPagamento('nada')).toBe(false);
    await expect(adaptador.verificarPagamento('nada')).rejects.toBeInstanceOf(ErroSistemaExterno);
  });

  it('o gateway recusa valor zero ou negativo', async () => {
    const adaptador = criarAdaptadorPagamento(provedor, new LivroTransacoesMemoria());

    await expect(adaptador.efetuarPagamento(0, 'a', 'b')).rejects.toBeInstanceOf(
      ErroSistemaExterno,
    );
  });
});

describe('GatewayPagamento', () => {
  it('em centavos recusa valor fracionado: é o adaptador que converte', async () => {
    const gateway = new GatewayPagamento(PERFIL_STRIPE, new LivroTransacoesMemoria());
    const dados = { pagador: 'a', recebedor: 'b', moeda: 'brl' };

    await expect(gateway.processarPagamento(10.5, dados)).rejects.toThrow('centavos inteiros');
    expect(await new AdaptadorStripe(gateway).efetuarPagamento(10.5, 'a', 'b')).toMatch(/^ch_/);
  });
});

describe.each(['linkedin', 'indeed'] as const)('Adaptador de profissionais %s', (provedor) => {
  const criar = () => criarAdaptadorProfissional(provedor, new RepositorioProfissionaisMemoria());

  it('converte os perfis externos em profissionais do domínio, com id próprio', async () => {
    const profissionais = await criar().listarProfissionais();

    expect(profissionais).toHaveLength(PAPEIS.length);
    for (const profissional of profissionais) {
      expect(profissional.id.startsWith(`${provedor}:`)).toBe(true);
      expect(profissional.competencias.length).toBeGreaterThan(0);
      expect(profissional.notaMedia).toBeGreaterThanOrEqual(4);
      expect(profissional.notaMedia).toBeLessThanOrEqual(5);
    }
  });

  it('cobre todos os papéis e filtra pelos critérios padronizados', async () => {
    const adaptador = criar();
    const periodo = Intervalo.criar(
      new Date('2027-01-01T00:00:00.000Z'),
      new Date('2027-02-01T00:00:00.000Z'),
    );

    const editores = await adaptador.listarProfissionais({ papeis: [Papel.EDITOR] });
    const nenhum = await adaptador.listarProfissionais({ precoMinimoAte: 1 });
    const disponiveis = await adaptador.listarProfissionais({ periodo });
    const excluidos = await adaptador.listarProfissionais({
      papeis: [Papel.EDITOR],
      excluirIds: editores.map((profissional) => profissional.id),
    });

    expect(editores).toHaveLength(1);
    expect(editores[0]?.atuaComo(Papel.EDITOR)).toBe(true);
    expect(nenhum).toEqual([]);
    expect(disponiveis).toHaveLength(PAPEIS.length);
    expect(excluidos).toEqual([]);
  });

  it('detalha um profissional e registra avaliação na escala do sistema externo', async () => {
    const adaptador = criar();
    const [primeiro] = await adaptador.listarProfissionais();
    const id = primeiro?.id ?? '';

    await adaptador.registrarAvaliacao(id, criarAvaliacao({ nota: 1 }));
    const detalhado = await adaptador.detalharProfissional(id);

    expect(detalhado.nome).toBe(primeiro?.nome);
    expect(detalhado.totalAvaliacoes).toBe((primeiro?.totalAvaliacoes ?? 0) + 1);
    expect(detalhado.notaMedia).toBeLessThan(primeiro?.notaMedia ?? 0);
  });

  it('imita o erro da API real para perfil inexistente', async () => {
    await expect(criar().detalharProfissional(`${provedor}:999`)).rejects.toBeInstanceOf(
      ErroSistemaExterno,
    );
  });
});

describe('AdaptadorInterno', () => {
  const criar = () => {
    const cadastro = new RepositorioProfissionaisMemoria([
      criarProfissional({ id: 'ana', especialidades: [Papel.DIRETOR] }),
      criarProfissional({ id: 'inativa', especialidades: [Papel.DIRETOR], ativo: false }),
    ]);
    return { cadastro, adaptador: criarAdaptadorProfissional('interno', cadastro) };
  };

  it('lê do cadastro interno sem marcar a origem como externa', async () => {
    const { adaptador } = criar();

    expect(adaptador.externo).toBe(false);
    expect((await adaptador.listarProfissionais()).map(({ id }) => id)).toEqual(['ana']);
    expect((await adaptador.detalharProfissional('ana')).id).toBe('ana');
  });

  it('não trata como interno o perfil espelhado de um provedor externo', async () => {
    const { adaptador, cadastro } = criar();

    cadastro.salvarTodos([
      criarProfissional({ id: 'linkedin:101' }),
      criarProfissional({ id: 'indeed:idx-201' }),
    ]);

    expect((await adaptador.listarProfissionais()).map(({ id }) => id)).toEqual(['ana']);
  });

  it('registra a avaliação no cadastro', async () => {
    const { adaptador } = criar();

    await adaptador.registrarAvaliacao('ana', criarAvaliacao({ nota: 3 }));

    expect((await adaptador.detalharProfissional('ana')).notaMedia).toBe(3);
  });

  it('responde NAO_ENCONTRADO para id desconhecido', async () => {
    await expect(criar().adaptador.detalharProfissional('nada')).rejects.toMatchObject({
      codigo: 'NAO_ENCONTRADO',
    });
  });
});

describe('FonteCadastroAdaptada', () => {
  it('espelha no cadastro interno só o que vem de fora', async () => {
    const espelho = new RepositorioProfissionaisMemoria();
    const interno = criarAdaptadorProfissional('interno', espelho);
    const externo = criarAdaptadorProfissional('linkedin', espelho);
    const fonte = new FonteCadastroAdaptada(interno, espelho);

    expect(await fonte.listarAtivos()).toEqual([]);
    expect(espelho.total).toBe(0);

    fonte.usar(externo);

    expect(await fonte.listarAtivos()).toHaveLength(PAPEIS.length);
    expect(espelho.total).toBe(PAPEIS.length);
    expect(await fonte.listarAtivos()).toHaveLength(PAPEIS.length);
    expect(await interno.listarProfissionais()).toEqual([]);
  });
});

describe('CadastroViaAdaptador', () => {
  it('transforma a listagem do adaptador em um resultado de busca', async () => {
    const adaptador = criarAdaptadorProfissional('indeed', new RepositorioProfissionaisMemoria());
    const periodo = Intervalo.criar(
      new Date('2027-01-01T00:00:00.000Z'),
      new Date('2027-02-01T00:00:00.000Z'),
    );

    const resultado = await new CadastroViaAdaptador(adaptador).buscarCandidatos({
      papeis: [Papel.DIRETOR],
      periodo,
      precoMinimoAte: 100_000,
    });

    expect(resultado.profissionais).toHaveLength(1);
    expect(resultado.parcial).toBe(false);
    expect(resultado.avisos).toEqual([]);
  });
});
