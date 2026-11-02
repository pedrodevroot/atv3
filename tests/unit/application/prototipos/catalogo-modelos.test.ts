import { describe, expect, it } from 'vitest';
import { CatalogoModelos } from '../../../../src/application/prototipos/catalogo-modelos.js';
import { criarModelosPadrao } from '../../../../src/application/prototipos/modelos-padrao.js';
import { ProjetoAnimacao } from '../../../../src/domain/entidades/projetos/projeto-animacao.js';
import { ProjetoDocumentario } from '../../../../src/domain/entidades/projetos/projeto-documentario.js';
import { criarProjeto } from '../../../fixtures/dominio.js';
import { criarFabricas } from '../../../fixtures/fabricas.js';

function criarCatalogo() {
  return new CatalogoModelos(criarModelosPadrao(criarFabricas()));
}

describe('CatalogoModelos (registro de protótipos)', () => {
  it('oferece um modelo pré-configurado para cada tipo com fábrica', () => {
    const modelos = criarCatalogo().listar();

    expect(modelos.map((modelo) => [modelo.id, modelo.prototipo.tipoCaptacao])).toEqual([
      ['documentario-entrevistas', 'DOCUMENTARIO'],
      ['animacao-3d-curta', 'ANIMACAO'],
      ['publicitario-digital', 'PUBLICITARIO'],
      ['ficcao-longa', 'FICCAO'],
    ]);
    expect(modelos.map((modelo) => modelo.prototipo.estrategia)).toEqual([
      'recomendador-documentario',
      'recomendador-animacao',
      'recomendador-publicitario',
      'recomendador-ficcao',
    ]);
  });

  it('cria projetos novos clonando o modelo com os ajustes do produtor', () => {
    const catalogo = criarCatalogo();

    const primeiro = catalogo.clonar('animacao-3d-curta', {
      titulo: 'Lobo-guará',
      produtorId: 'produtora-cerrado',
      detalhes: { softwares: ['Blender'] },
    });
    const segundo = catalogo.clonar('animacao-3d-curta');

    expect(primeiro).toBeInstanceOf(ProjetoAnimacao);
    expect(primeiro.titulo).toBe('Lobo-guará');
    expect(primeiro.produtorId).toBe('produtora-cerrado');
    expect(primeiro.detalhes).toEqual({
      tecnica: '3D',
      softwares: ['Blender'],
      quadrosPorSegundo: 24,
    });
    expect(primeiro.id).not.toBe(segundo.id);
    expect(segundo.detalhes).toEqual({
      tecnica: '3D',
      softwares: ['Blender', 'Maya'],
      quadrosPorSegundo: 24,
    });
  });

  it('o protótipo guardado não muda quando clones ou cópias listadas mudam', () => {
    const catalogo = criarCatalogo();
    const clone = catalogo.clonar('documentario-entrevistas');
    clone.solicitarReavaliacao({ orcamento: 10_000 });
    const [listado] = catalogo.listar();
    listado?.prototipo.solicitarReavaliacao({ orcamento: 20_000 });

    expect(catalogo.listar()[0]?.prototipo.orcamento).toBe(180_000);
    expect(catalogo.clonar('documentario-entrevistas')).toBeInstanceOf(ProjetoDocumentario);
  });

  it('guarda uma cópia do protótipo registrado, não a referência original', () => {
    const original = criarProjeto();
    const catalogo = new CatalogoModelos([
      { id: 'meu-modelo', nome: 'Meu modelo', descricao: 'teste', prototipo: original },
    ]);
    original.solicitarReavaliacao({ orcamento: 55_000 });

    expect(catalogo.clonar('meu-modelo').orcamento).toBe(100_000);
    expect(catalogo.ids).toEqual(['meu-modelo']);
  });

  it('recusa modelo desconhecido e id repetido', () => {
    const catalogo = criarCatalogo();

    expect(() => catalogo.clonar('novela')).toThrow(
      expect.objectContaining({ codigo: 'NAO_ENCONTRADO' }) as Error,
    );
    expect(() => {
      catalogo.registrar({
        id: 'ficcao-longa',
        nome: 'Outro',
        descricao: 'repetido',
        prototipo: criarProjeto(),
      });
    }).toThrow(expect.objectContaining({ codigo: 'PARAMETROS_INVALIDOS' }) as Error);
  });
});
