import type { Convite } from '../../domain/entidades/convite.js';
import type { Papel } from '../../domain/enums/papel.js';

export interface RepositorioConvites {
  obter(id: string): Promise<Convite | undefined>;
  salvar(convite: Convite): Promise<void>;
  pendenteDoPapel(equipeId: string, papel: Papel): Promise<Convite | undefined>;
  expirarVencidos(agora: Date): Promise<Convite[]>;
  cancelarPendentesDasEquipes(equipeIds: readonly string[]): Promise<Convite[]>;
}
