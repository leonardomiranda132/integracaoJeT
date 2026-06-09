import { ManualStepRunner } from "../../components/manual-step-runner";
import { listManualSteps } from "../../lib/server/manual-steps";

export const dynamic = "force-dynamic";

export default function StepsPage() {
  const steps = listManualSteps();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Passo a passo</h1>
          <p>
            Execucao separada dos comandos operacionais da integracao, com envio real da J&amp;T
            bloqueado nos passos sensiveis.
          </p>
        </div>
      </header>

      <ManualStepRunner steps={steps} />
    </div>
  );
}
