export type Relogio = () => Date;

export const relogioDoSistema: Relogio = () => new Date();
