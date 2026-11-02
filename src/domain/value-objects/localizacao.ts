import { garantir, garantirTexto } from '../comum/erro-dominio.js';
import { mesmoTexto } from '../comum/texto.js';

const RAIO_TERRA_KM = 6371;

export interface DadosLocalizacao {
  cidade: string;
  uf: string;
  latitude: number;
  longitude: number;
}

export class Localizacao {
  private constructor(
    readonly cidade: string,
    readonly uf: string,
    readonly latitude: number,
    readonly longitude: number,
  ) {}

  static criar(dados: DadosLocalizacao): Localizacao {
    const cidade = garantirTexto(dados.cidade, 'Cidade');
    const uf = dados.uf.trim().toUpperCase();
    garantir(/^[A-Z]{2}$/.test(uf), 'UF deve ter duas letras.');
    garantir(
      Number.isFinite(dados.latitude) && Math.abs(dados.latitude) <= 90,
      'Latitude deve estar entre -90 e 90.',
    );
    garantir(
      Number.isFinite(dados.longitude) && Math.abs(dados.longitude) <= 180,
      'Longitude deve estar entre -180 e 180.',
    );
    return new Localizacao(cidade, uf, dados.latitude, dados.longitude);
  }

  mesmaUf(outra: Localizacao): boolean {
    return this.uf === outra.uf;
  }

  mesmaCidade(outra: Localizacao): boolean {
    return this.mesmaUf(outra) && mesmoTexto(this.cidade, outra.cidade);
  }

  distanciaKm(outra: Localizacao): number {
    const radianos = (graus: number) => (graus * Math.PI) / 180;
    const deltaLatitude = radianos(outra.latitude - this.latitude);
    const deltaLongitude = radianos(outra.longitude - this.longitude);
    const a =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(radianos(this.latitude)) *
        Math.cos(radianos(outra.latitude)) *
        Math.sin(deltaLongitude / 2) ** 2;
    return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  }
}
