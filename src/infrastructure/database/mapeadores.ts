import { Avaliacao } from '../../domain/entidades/avaliacao.js';
import { Competencia } from '../../domain/entidades/competencia.js';
import { Convite } from '../../domain/entidades/convite.js';
import { Equipe } from '../../domain/entidades/equipe.js';
import { MembroEquipe } from '../../domain/entidades/membro-equipe.js';
import { ParticipacaoProjeto } from '../../domain/entidades/participacao-projeto.js';
import { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import { Recomendacao } from '../../domain/entidades/recomendacao.js';
import { RequisitoPapel } from '../../domain/entidades/requisito-papel.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { StatusConvite, StatusEquipe, StatusMembro } from '../../domain/enums/status.js';
import type { TipoCaptacao } from '../../domain/enums/tipo-captacao.js';
import type { RegistroFabricas } from '../../application/familias/registro-fabricas.js';
import { FaixaPreco } from '../../domain/value-objects/faixa-preco.js';
import { Intervalo } from '../../domain/value-objects/intervalo.js';
import { Localizacao } from '../../domain/value-objects/localizacao.js';
import type {
  AvaliacaoRow,
  CompetenciaRow,
  DisponibilidadeRow,
  ParticipacaoRow,
  ProfissionalRow,
} from './schemas/profissional.schema.js';
import type {
  ConviteRow,
  EquipeRow,
  MembroEquipeRow,
  ProjetoRow,
  RecomendacaoRow,
  RequisitoPapelRow,
} from './schemas/projeto.schema.js';

type Numerico = number | string;

export interface ProfissionalCompletoRow extends Omit<
  ProfissionalRow,
  'preco_minimo' | 'preco_maximo' | 'nota_media'
> {
  preco_minimo: Numerico;
  preco_maximo: Numerico;
  nota_media: Numerico;
  competencias: { nome: string; nivel: number }[];
  avaliacoes: (Omit<AvaliacaoRow, 'profissional_id' | 'data' | 'nota'> & {
    nota: Numerico;
    data: string;
  })[];
  historico: Omit<ParticipacaoRow, 'id' | 'profissional_id'>[];
  disponibilidades: { inicio: string; fim: string }[];
}

export interface LinhasProfissional {
  profissional: ProfissionalRow;
  competencias: CompetenciaRow[];
  avaliacoes: AvaliacaoRow[];
  historico: ParticipacaoRow[];
  disponibilidades: DisponibilidadeRow[];
}

export function paraProfissional(linha: ProfissionalCompletoRow): Profissional {
  return Profissional.criar({
    id: linha.id,
    nome: linha.nome,
    especialidades: linha.especialidades as Papel[],
    competencias: linha.competencias.map((competencia) =>
      Competencia.criar(competencia.nome, competencia.nivel),
    ),
    avaliacoes: linha.avaliacoes.map((avaliacao) =>
      Avaliacao.criar({
        id: avaliacao.id,
        nota: Number(avaliacao.nota),
        comentario: avaliacao.comentario,
        data: new Date(avaliacao.data),
        produtorId: avaliacao.produtor_id,
        projetoId: avaliacao.projeto_id,
        papel: avaliacao.papel as Papel,
        genero: avaliacao.genero,
        tipoCaptacao: avaliacao.tipo_captacao as TipoCaptacao,
      }),
    ),
    historico: linha.historico.map((participacao) =>
      ParticipacaoProjeto.criar({
        projetoId: participacao.projeto_id,
        titulo: participacao.titulo,
        papel: participacao.papel as Papel,
        genero: participacao.genero,
        tipoCaptacao: participacao.tipo_captacao as TipoCaptacao,
        ano: participacao.ano,
      }),
    ),
    faixaPreco: FaixaPreco.criar(Number(linha.preco_minimo), Number(linha.preco_maximo)),
    disponibilidades: linha.disponibilidades.map((disponibilidade) =>
      Intervalo.criar(new Date(disponibilidade.inicio), new Date(disponibilidade.fim)),
    ),
    localizacao: Localizacao.criar({
      cidade: linha.cidade,
      uf: linha.uf,
      latitude: linha.latitude,
      longitude: linha.longitude,
    }),
    ativo: linha.ativo,
  });
}

export function deProfissional(profissional: Profissional): LinhasProfissional {
  const profissionalId = profissional.id;
  return {
    profissional: {
      id: profissionalId,
      nome: profissional.nome,
      especialidades: [...profissional.especialidades],
      preco_minimo: profissional.faixaPreco.minimo,
      preco_maximo: profissional.faixaPreco.maximo,
      cidade: profissional.localizacao.cidade,
      uf: profissional.localizacao.uf,
      latitude: profissional.localizacao.latitude,
      longitude: profissional.localizacao.longitude,
      ativo: profissional.ativo,
      nota_media: Math.round(profissional.notaMedia * 100) / 100,
      total_avaliacoes: profissional.totalAvaliacoes,
    },
    competencias: profissional.competencias.map((competencia) => ({
      profissional_id: profissionalId,
      nome: competencia.nome,
      nivel: competencia.nivel,
    })),
    avaliacoes: profissional.avaliacoes.map((avaliacao) => ({
      id: avaliacao.id,
      profissional_id: profissionalId,
      nota: avaliacao.nota,
      comentario: avaliacao.comentario,
      data: avaliacao.data,
      produtor_id: avaliacao.produtorId,
      projeto_id: avaliacao.projetoId,
      papel: avaliacao.papel,
      genero: avaliacao.genero,
      tipo_captacao: avaliacao.tipoCaptacao,
    })),
    historico: profissional.historico.map((participacao) => ({
      profissional_id: profissionalId,
      projeto_id: participacao.projetoId,
      titulo: participacao.titulo,
      papel: participacao.papel,
      genero: participacao.genero,
      tipo_captacao: participacao.tipoCaptacao,
      ano: participacao.ano,
    })),
    disponibilidades: profissional.disponibilidades.map((disponibilidade) => ({
      profissional_id: profissionalId,
      inicio: disponibilidade.inicio,
      fim: disponibilidade.fim,
    })),
  };
}

export interface LinhasProjeto {
  projeto: ProjetoRow;
  requisitos: RequisitoPapelRow[];
  equipes: EquipeRow[];
  membros: MembroEquipeRow[];
}

export function deProjeto(projeto: Projeto): LinhasProjeto {
  return {
    projeto: {
      id: projeto.id,
      titulo: projeto.titulo,
      produtor_id: projeto.produtorId,
      genero: projeto.genero,
      tipo_captacao: projeto.tipoCaptacao,
      duracao_minutos: projeto.duracaoMinutos,
      orcamento: projeto.orcamento,
      data_inicio: projeto.periodo.inicio,
      data_entrega: projeto.dataEntrega,
      cidade: projeto.localizacao.cidade,
      uf: projeto.localizacao.uf,
      latitude: projeto.localizacao.latitude,
      longitude: projeto.localizacao.longitude,
      estrategia: projeto.estrategia,
      criado_em: projeto.criadoEm,
      detalhes: { ...projeto.detalhes },
    },
    requisitos: projeto.requisitos.map((requisito, ordem) => ({
      projeto_id: projeto.id,
      papel: requisito.papel,
      peso: requisito.peso,
      ordem,
    })),
    equipes: projeto.equipes.map((equipe, ordem) => ({
      id: equipe.id,
      projeto_id: projeto.id,
      estrategia: equipe.estrategia,
      status: equipe.status,
      rodada: equipe.rodada,
      criada_em: equipe.criadaEm,
      ordem,
      descartados: [...equipe.profissionaisDescartados],
    })),
    membros: projeto.equipes.flatMap((equipe) =>
      equipe.membros.map((membro, ordem) => ({
        equipe_id: equipe.id,
        papel: membro.papel,
        profissional_id: membro.profissional.id,
        custo: membro.custo,
        score: membro.score,
        status: membro.status,
        ordem,
      })),
    ),
  };
}

export interface LinhasProjetoLidas {
  projeto: Omit<ProjetoRow, 'orcamento'> & { orcamento: Numerico };
  requisitos: (Omit<RequisitoPapelRow, 'peso'> & { peso: Numerico })[];
  equipes: EquipeRow[];
  membros: (Omit<MembroEquipeRow, 'custo'> & { custo: Numerico })[];
}

export function paraProjeto(
  linhas: LinhasProjetoLidas,
  profissionais: ReadonlyMap<string, Profissional>,
  fabricas: RegistroFabricas,
): Projeto {
  const { projeto } = linhas;
  const equipes = linhas.equipes.map((equipe) =>
    Equipe.criar({
      id: equipe.id,
      projetoId: equipe.projeto_id,
      estrategia: equipe.estrategia,
      status: equipe.status as StatusEquipe,
      rodada: equipe.rodada,
      criadaEm: equipe.criada_em,
      descartados: equipe.descartados,
      membros: linhas.membros
        .filter((membro) => membro.equipe_id === equipe.id)
        .sort((a, b) => a.ordem - b.ordem)
        .flatMap((membro) => {
          const profissional = profissionais.get(membro.profissional_id);
          return profissional
            ? [
                MembroEquipe.criar({
                  papel: membro.papel as Papel,
                  profissional,
                  custo: Number(membro.custo),
                  score: membro.score,
                  status: membro.status as StatusMembro,
                }),
              ]
            : [];
        }),
    }),
  );
  return fabricas.para(projeto.tipo_captacao).criarProjeto({
    id: projeto.id,
    titulo: projeto.titulo,
    produtorId: projeto.produtor_id,
    genero: projeto.genero,
    duracaoMinutos: projeto.duracao_minutos,
    orcamento: Number(projeto.orcamento),
    dataInicio: projeto.data_inicio,
    dataEntrega: projeto.data_entrega,
    localizacao: Localizacao.criar({
      cidade: projeto.cidade,
      uf: projeto.uf,
      latitude: projeto.latitude,
      longitude: projeto.longitude,
    }),
    requisitos: [...linhas.requisitos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((requisito) => RequisitoPapel.criar(requisito.papel as Papel, Number(requisito.peso))),
    estrategia: projeto.estrategia,
    equipes,
    criadoEm: projeto.criado_em,
    detalhes: projeto.detalhes,
  });
}

export function deConvite(convite: Convite): ConviteRow {
  return {
    id: convite.id,
    projeto_id: convite.projetoId,
    equipe_id: convite.equipeId,
    papel: convite.papel,
    profissional_id: convite.profissionalId,
    produtor_id: convite.produtorId,
    status: convite.status,
    criado_em: convite.criadoEm,
    expira_em: convite.expiraEm,
    respondido_em: convite.respondidoEm ?? null,
  };
}

export function paraConvite(linha: ConviteRow): Convite {
  return Convite.restaurar({
    id: linha.id,
    projetoId: linha.projeto_id,
    equipeId: linha.equipe_id,
    papel: linha.papel as Papel,
    profissionalId: linha.profissional_id,
    produtorId: linha.produtor_id,
    criadoEm: linha.criado_em,
    expiraEm: linha.expira_em,
    status: linha.status as StatusConvite,
    ...(linha.respondido_em ? { respondidoEm: linha.respondido_em } : {}),
  });
}

export function deRecomendacao(recomendacao: Recomendacao): RecomendacaoRow {
  return {
    id: recomendacao.id,
    projeto_id: recomendacao.projetoId,
    equipe_id: recomendacao.equipeId ?? null,
    papel: recomendacao.papel,
    profissional_id: recomendacao.profissionalId,
    score: recomendacao.score,
    posicao: recomendacao.posicao,
    estrategia: recomendacao.estrategia,
    rodada: recomendacao.rodada,
    justificativa: recomendacao.justificativa,
    criada_em: recomendacao.criadaEm,
  };
}

export function paraRecomendacao(linha: RecomendacaoRow): Recomendacao {
  return Recomendacao.criar({
    id: linha.id,
    projetoId: linha.projeto_id,
    ...(linha.equipe_id ? { equipeId: linha.equipe_id } : {}),
    papel: linha.papel as Papel,
    profissionalId: linha.profissional_id,
    score: linha.score,
    posicao: linha.posicao,
    estrategia: linha.estrategia,
    rodada: linha.rodada,
    justificativa: linha.justificativa,
    criadaEm: linha.criada_em,
  });
}
