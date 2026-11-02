import type { AdaptadorArmazenamento } from '../../application/ports/adaptador-armazenamento.js';
import type { AdaptadorPagamento } from '../../application/ports/adaptador-pagamento.js';
import type {
  AdaptadorProfissional,
  CadastroInterno,
} from '../../application/ports/adaptador-profissional.js';
import type {
  ProvedorArmazenamento,
  ProvedorPagamento,
  ProvedorProfissional,
} from '../../config/config.js';
import { ApiProfissionalExterna } from '../externos/api-profissional-externa.js';
import { ArmazenamentoExterno, type DepositoObjetos } from '../externos/armazenamento-externo.js';
import { GatewayPagamento, type LivroTransacoes } from '../externos/gateway-pagamento.js';
import { criarPerfisIndeed, criarPerfisLinkedIn } from '../externos/perfis-simulados.js';
import { AdaptadorGoogleCloud } from './armazenamento/adaptador-google-cloud.js';
import { AdaptadorLocal } from './armazenamento/adaptador-local.js';
import { AdaptadorS3 } from './armazenamento/adaptador-s3.js';
import { AdaptadorPagSeguro, PERFIL_PAGSEGURO } from './pagamento/adaptador-pagseguro.js';
import { AdaptadorPayPal, PERFIL_PAYPAL } from './pagamento/adaptador-paypal.js';
import { AdaptadorStripe, PERFIL_STRIPE } from './pagamento/adaptador-stripe.js';
import { AdaptadorIndeed } from './profissional/adaptador-indeed.js';
import { AdaptadorInterno } from './profissional/adaptador-interno.js';
import { AdaptadorLinkedIn } from './profissional/adaptador-linkedin.js';

export function criarAdaptadorArmazenamento(
  provedor: ProvedorArmazenamento,
  deposito: DepositoObjetos,
  diretorioLocal: string,
): AdaptadorArmazenamento {
  switch (provedor) {
    case 's3':
      return new AdaptadorS3(new ArmazenamentoExterno('s3', deposito));
    case 'google-cloud':
      return new AdaptadorGoogleCloud(new ArmazenamentoExterno('google-cloud', deposito));
    case 'local':
      return new AdaptadorLocal(diretorioLocal);
  }
}

export function criarAdaptadorPagamento(
  provedor: ProvedorPagamento,
  livro: LivroTransacoes,
): AdaptadorPagamento {
  switch (provedor) {
    case 'stripe':
      return new AdaptadorStripe(new GatewayPagamento(PERFIL_STRIPE, livro));
    case 'pagseguro':
      return new AdaptadorPagSeguro(new GatewayPagamento(PERFIL_PAGSEGURO, livro));
    case 'paypal':
      return new AdaptadorPayPal(new GatewayPagamento(PERFIL_PAYPAL, livro));
  }
}

export function criarAdaptadorProfissional(
  provedor: ProvedorProfissional,
  cadastro: CadastroInterno,
): AdaptadorProfissional {
  switch (provedor) {
    case 'interno':
      return new AdaptadorInterno(cadastro);
    case 'linkedin':
      return new AdaptadorLinkedIn(
        new ApiProfissionalExterna('linkedin', criarPerfisLinkedIn(), (perfil) => [perfil.cargo]),
      );
    case 'indeed':
      return new AdaptadorIndeed(
        new ApiProfissionalExterna('indeed', criarPerfisIndeed(), (perfil) => perfil.funcoes),
      );
  }
}
