# Análise crítica do microsserviço da ATVI

A ATVII pede que, antes de introduzir novos padrões, o código entregue na primeira etapa seja
examinado em busca de **rigidez** (uma mudança pequena exige alterar vários pontos),
**fragilidade** (uma correção quebra partes não relacionadas) e **imobilidade** (componentes que
não podem ser reaproveitados em outro contexto). Esta seção registra o que foi encontrado, o padrão
escolhido para cada problema e onde a correção está no código.

## Pontos encontrados

| #   | Onde estava (ATVI)                                                                                  | Sintoma     | Por que era um problema                                                                                                                                                                                                  | Correção (ATVII)                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `Projeto` era uma classe única, com construtor privado e o tipo guardado num campo (`tipoCaptacao`) | Rigidez     | Um tipo com dados próprios (tema e entrevistados de um documentário, técnica e softwares de uma animação) exigia mexer na entidade, em `DadosProjeto`, no schema da API, no mapeador e na tabela ao mesmo tempo.         | `Projeto` virou classe abstrata; cada tipo é uma subclasse (`ProjetoDocumentario`, `ProjetoAnimacao`, `ProjetoPublicitario`, `ProjetoFiccao`) com seus atributos e validações.         |
| 2   | `CatalogoPerfis.ajustesPorTipo`, dentro da camada de estratégias                                    | Imobilidade | O conhecimento de cada tipo de projeto morava no algoritmo de recomendação. Não dava para reaproveitar a similaridade de cosseno sem carregar junto o mapa de todos os tipos, e um tipo novo exigia editar a estratégia. | O catálogo passou a receber os ajustes de fora. Cada família tem o seu recomendador (`RecomendadorAnimacao`, etc.) com os ajustes do tipo; a estratégia genérica usa só o perfil base. |
| 3   | `CriarProjetoERecomendar` e o mapeador do banco montavam `Projeto.criar({...})` campo a campo       | Rigidez     | Toda criação repetia a mesma lista de campos e não havia como oferecer um projeto pronto para ajustes: cada cadastro começava do zero.                                                                                   | **Prototype**: `clonar()` em cada subclasse e um `CatalogoModelos` com modelos pré-configurados que o produtor clona e ajusta.                                                         |
| 4   | `container.ts` criava um único `OrquestradorPadrao` e um único `OrquestradorSubstituicao`           | Rigidez     | Validação, recomendação e notificação eram as mesmas para qualquer tipo. Especializar exigiria `if (tipo === ...)` dentro do orquestrador ou dos casos de uso.                                                           | **Abstract Factory**: o orquestrador recebe uma `FabricaProjeto` no construtor e obtém dela validador e recomendador; o `SistemaRecomendacao` escolhe a fábrica pelo tipo.             |
| 5   | O enum `TipoCaptacao` tinha só `DOCUMENTARIO`, `FICCAO` e `ANIMACAO`                                | Rigidez     | Agências de publicidade, citadas no enunciado, não tinham onde se encaixar.                                                                                                                                              | `PUBLICITARIO` entrou como tipo com fábrica própria. Um tipo novo é só uma fábrica nova registrada; o teste de realidade virtual mostra isso.                                          |
| 6   | Notificações eram iguais para todos os projetos (`compositor-notificacoes.ts`)                      | Imobilidade | Não havia como avisar o produtor de um documentário sobre autorizações de imagem, ou o de uma animação sobre renderização, sem espalhar condicionais pelo compositor.                                                    | Cada família tem um notificador (`NotificadorDocumentario`, etc.). Os observadores genéricos da ATVI continuam iguais.                                                                 |
| 7   | O relatório (`GeradorRelatorio`) não mostrava nada específico do tipo                               | Rigidez     | Incluir dados do tipo exigiria testar o tipo dentro do visitante.                                                                                                                                                        | `Projeto.detalhes` é polimórfico; o relatório imprime os detalhes de qualquer subclasse sem saber qual é.                                                                              |

Um ponto examinado e **mantido**: o bônus `bonusMesmoTipo` da filtragem colaborativa compara o tipo
da avaliação com o tipo do projeto por igualdade. Isso não é uma condicional por tipo concreto: vale
para qualquer tipo, inclusive um novo, sem alteração.

## Decisões tomadas

1. **`FICCAO` foi mantido**, com uma `FabricaFiccao`. Ele já existia no cadastro e nos testes da
   ATVI; removê-lo quebraria dados e funcionalidades entregues. Ele também mostra que o tipo
   "genérico" é só mais uma família.
2. **O clone ganha um id novo e copia requisitos, local, prazo, estratégia e detalhes**, mas **não
   copia as equipes sugeridas**. Um projeto criado a partir de outro não deve herdar sugestões
   e convites que pertencem ao original. A cópia é profunda: requisitos, local, datas e listas
   específicas são objetos novos.
3. **A estratégia escolhida pelo produtor prevalece.** Se o produtor escolhe
   `similaridade-cosseno`, `filtragem-colaborativa` ou `regras-orcamento`, o Strategy da ATVI é
   usado. Se não escolhe, o projeto usa o recomendador da fábrica do seu tipo; com orçamento
   reduzido, continua valendo a sugestão de `regras-orcamento` da ATVI.
4. **A fábrica fica fora da entidade.** O diagrama liga `Projeto` a `FabricaProjeto`, mas os
   produtos da fábrica (recomendador e notificador) pertencem à camada de aplicação. Para manter a
   inversão de dependência da ATVI, o domínio não conhece a fábrica: o `RegistroFabricas` resolve a
   fábrica a partir do tipo do projeto.
5. **As regras de tipo que bloqueiam são poucas e explícitas.** Documentário sem entrevistado,
   animação sem `EFEITOS_VISUAIS` e publicidade sem meio de veiculação são erros. As demais regras
   (som direto no documentário, prazo longo na publicidade, competências dos membros) são alertas,
   que aparecem no relatório sem impedir a recomendação.

## Como verificar

- `npm run demo` imprime as sete demonstrações; as três últimas são Prototype, Factory Method e
  Abstract Factory.
- `tests/integration/fabricas-projeto.test.ts` alterna as quatro fábricas com PostgreSQL real e
  confere recomendação, validação, notificação e releitura do banco. Registra uma fábrica de
  realidade virtual criada só no teste e verifica que o código do orquestrador e do
  `SistemaRecomendacao` não cita nenhum tipo concreto.
