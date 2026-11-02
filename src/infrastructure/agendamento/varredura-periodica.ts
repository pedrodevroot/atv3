export interface VarreduraPeriodica {
  parar(): void;
}

export function agendarVarredura(
  executar: () => Promise<unknown>,
  intervaloMs: number,
  aoFalhar: (erro: unknown) => void,
): VarreduraPeriodica {
  let emAndamento = false;
  const temporizador = setInterval(() => {
    if (emAndamento) {
      return;
    }
    emAndamento = true;
    executar()
      .catch(aoFalhar)
      .finally(() => {
        emAndamento = false;
      });
  }, intervaloMs);
  temporizador.unref();
  return {
    parar: () => {
      clearInterval(temporizador);
    },
  };
}
