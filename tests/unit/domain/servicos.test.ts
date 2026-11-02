import { describe, expect, it } from 'vitest';
import { ProjetoFiccao } from '../../../src/domain/entidades/projetos/projeto-ficcao.js';
import { RequisitoPapel } from '../../../src/domain/entidades/requisito-papel.js';
import {
  NOME_PACOTE_DO_PROJETO,
  PacoteServico,
  pacoteDeRequisitos,
  requisitosDoServico,
  servicoDeDados,
} from '../../../src/domain/entidades/servicos/pacote-servico.js';
import { ServicoAtomico } from '../../../src/domain/entidades/servicos/servico-atomico.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import { criarProjeto, dadosProjetoBase } from '../../fixtures/dominio.js';
import {
  SERVICO_DOIS_NIVEIS,
  SERVICO_QUATRO_NIVEIS,
  SERVICO_RASO,
  TOTAIS_QUATRO_NIVEIS,
  semRequisitos,
} from '../../fixtures/servicos.js';

function dadosSemRequisitos() {
  return semRequisitos(dadosProjetoBase());
}

describe('Composite: hierarquia de serviços', () => {
  it.each([
    ['um serviço atômico', SERVICO_RASO, 8_000, 10],
    ['um pacote de dois níveis', SERVICO_DOIS_NIVEIS, 11_000.5, 15],
    [
      'um pacote de quatro níveis',
      SERVICO_QUATRO_NIVEIS,
      TOTAIS_QUATRO_NIVEIS.custo,
      TOTAIS_QUATRO_NIVEIS.prazo,
    ],
  ])('calcula custo e prazo de %s com a mesma interface', (_nome, dados, custo, prazo) => {
    const servico = servicoDeDados(dados);

    expect(servico.calcularCusto()).toBe(custo);
    expect(servico.obterPrazo()).toBe(prazo);
    expect(servico.validar()).toEqual([]);
  });

  it('não acumula erro de ponto flutuante ao somar centavos', () => {
    const pacote = PacoteServico.criar('Centavos', [
      ServicoAtomico.criar({ nome: 'a', papel: Papel.EDITOR, custo: 0.1, prazoDias: 0 }),
      ServicoAtomico.criar({ nome: 'b', papel: Papel.EDITOR, custo: 0.2, prazoDias: 0 }),
    ]);

    expect(pacote.calcularCusto()).toBe(0.3);
  });

  it('lista os subserviços diretos e devolve lista vazia no serviço atômico', () => {
    const pacote = servicoDeDados(SERVICO_DOIS_NIVEIS);

    expect(pacote.listarSubservicos().map((servico) => servico.nome)).toEqual([
      'Edição',
      'Mixagem de áudio',
    ]);
    expect(servicoDeDados(SERVICO_RASO).listarSubservicos()).toEqual([]);
  });

  it('a lista devolvida não permite alterar o pacote', () => {
    const pacote = servicoDeDados(SERVICO_DOIS_NIVEIS);
    const lista = pacote.listarSubservicos() as unknown[];

    lista.pop();

    expect(pacote.listarSubservicos()).toHaveLength(2);
  });

  it('a validação desce até o serviço atômico inválido, em qualquer profundidade', () => {
    const invalido = ServicoAtomico.criar({
      nome: 'Maquiagem',
      papel: 'MAQUIADOR' as Papel,
      custo: -1,
      prazoDias: 1.5,
      peso: 11,
    });
    const profundo = PacoteServico.criar('A', [
      PacoteServico.criar('B', [PacoteServico.criar('C', [invalido])]),
    ]);

    expect(profundo.validar()).toEqual([
      'Serviço "Maquiagem": papel MAQUIADOR não existe.',
      'Serviço "Maquiagem": custo não pode ser negativo.',
      'Serviço "Maquiagem": prazo deve ser um número inteiro de dias.',
      'Serviço "Maquiagem": peso deve ser maior que 0 e no máximo 10.',
    ]);
  });

  it('recusa pacote vazio e nomes em branco', () => {
    const pacote = PacoteServico.criar(' ', [
      PacoteServico.criar('Vazio', []),
      ServicoAtomico.criar({ nome: '', papel: Papel.EDITOR, custo: 0, prazoDias: 0 }),
    ]);

    expect(pacote.validar()).toEqual([
      'Pacote sem nome.',
      'Pacote "Vazio" não contém serviços.',
      'Serviço sem nome.',
    ]);
  });

  it('o clone é uma cópia profunda com o mesmo conteúdo', () => {
    const original = servicoDeDados(SERVICO_QUATRO_NIVEIS);
    const clone = original.clonar();

    expect(clone).not.toBe(original);
    expect(clone.listarSubservicos()[0]).not.toBe(original.listarSubservicos()[0]);
    expect(clone.exportar()).toEqual(original.exportar());
  });

  it('exportar e reconstruir preserva a árvore', () => {
    const original = servicoDeDados(SERVICO_QUATRO_NIVEIS);

    expect(servicoDeDados(original.exportar()).exportar()).toEqual(original.exportar());
  });

  it('deriva cada papel uma vez, na ordem em que aparece, com o maior peso', () => {
    const requisitos = requisitosDoServico(servicoDeDados(SERVICO_QUATRO_NIVEIS));

    expect(requisitos.map(({ papel, peso }) => [papel, peso])).toEqual([
      [Papel.DIRETOR, 5],
      [Papel.EDITOR, 4],
      [Papel.EFEITOS_VISUAIS, 1],
      [Papel.SONOPLASTA, 3],
    ]);
  });

  it('converte requisitos em um pacote simples, sem custo nem prazo', () => {
    const pacote = pacoteDeRequisitos([RequisitoPapel.criar(Papel.DIRETOR, 5)]);

    expect(pacote.nome).toBe(NOME_PACOTE_DO_PROJETO);
    expect(pacote.calcularCusto()).toBe(0);
    expect(pacote.obterPrazo()).toBe(0);
    expect(requisitosDoServico(pacote)[0]?.peso).toBe(5);
  });
});

describe('Composite: Projeto com servicoPrincipal', () => {
  it('delega custo e prazo ao serviço principal', () => {
    const projeto = ProjetoFiccao.criar({
      ...dadosSemRequisitos(),
      servicoPrincipal: servicoDeDados(SERVICO_QUATRO_NIVEIS),
    });

    expect(projeto.calcularCustoTotal()).toBe(TOTAIS_QUATRO_NIVEIS.custo);
    expect(projeto.obterPrazoTotal()).toBe(TOTAIS_QUATRO_NIVEIS.prazo);
    expect(projeto.papeisObrigatorios).toEqual([
      Papel.DIRETOR,
      Papel.EDITOR,
      Papel.EFEITOS_VISUAIS,
      Papel.SONOPLASTA,
    ]);
    expect(projeto.pesoDe(Papel.EDITOR)).toBe(4);
  });

  it('continua aceitando requisitos, convertidos em pacote simples', () => {
    const projeto = criarProjeto();

    expect(projeto.servicoPrincipal.listarSubservicos()).toHaveLength(2);
    expect(projeto.calcularCustoTotal()).toBe(0);
    expect(projeto.requisitos.map(({ papel, peso }) => [papel, peso])).toEqual([
      [Papel.DIRETOR, 5],
      [Papel.EDITOR, 3],
    ]);
  });

  it('recusa requisitos e serviço principal ao mesmo tempo', () => {
    expect(() =>
      ProjetoFiccao.criar({
        ...dadosProjetoBase(),
        servicoPrincipal: servicoDeDados(SERVICO_RASO),
      }),
    ).toThrow('Informe os requisitos ou o serviço principal do projeto, não os dois.');
  });

  it('recusa árvore inválida na criação', () => {
    expect(() =>
      ProjetoFiccao.criar({
        ...dadosSemRequisitos(),
        servicoPrincipal: PacoteServico.criar('Vazio', []),
      }),
    ).toThrow('Pacote "Vazio" não contém serviços.');
  });

  it('recusa projeto sem requisitos e sem serviço principal', () => {
    expect(() => ProjetoFiccao.criar(dadosSemRequisitos())).toThrow(
      'Projeto precisa de ao menos um papel obrigatório.',
    );
  });

  it('o clone copia a árvore em profundidade e aceita outra árvore nos ajustes', () => {
    const projeto = ProjetoFiccao.criar({
      ...dadosSemRequisitos(),
      servicoPrincipal: servicoDeDados(SERVICO_QUATRO_NIVEIS),
    });

    const clone = projeto.clonar();
    const ajustado = projeto.clonar({ servicoPrincipal: servicoDeDados(SERVICO_RASO) });
    const simples = projeto.clonar({ requisitos: [RequisitoPapel.criar(Papel.ROTEIRISTA, 2)] });

    expect(clone.servicoPrincipal).not.toBe(projeto.servicoPrincipal);
    expect(clone.calcularCustoTotal()).toBe(TOTAIS_QUATRO_NIVEIS.custo);
    expect(ajustado.calcularCustoTotal()).toBe(8_000);
    expect(simples.papeisObrigatorios).toEqual([Papel.ROTEIRISTA]);
  });
});
