export enum AgentState {
  Idle = 'idle',
  FetchingData = 'fetching_data',
  GeneratingDecision = 'generating_decision',
  Validating = 'validating',
  ComputingRisk = 'computing_risk',
  ApplyingGuardrails = 'applying_guardrails',
  Executing = 'executing',
  Waiting = 'waiting',
  Error = 'error',
  Paused = 'paused',
}

export enum AgentEvent {
  Tick = 'tick',
  DataFetched = 'data_fetched',
  DecisionGenerated = 'decision_generated',
  DecisionTimeout = 'decision_timeout',
  ValidationPassed = 'validation_passed',
  ValidationFailed = 'validation_failed',
  RiskComputed = 'risk_computed',
  GuardrailsPassed = 'guardrails_passed',
  GuardrailsRejected = 'guardrails_rejected',
  OrderPlaced = 'order_placed',
  OrderFailed = 'order_failed',
  ExchangeError = 'exchange_error',
  ExchangeUnauthorized = 'exchange_unauthorized',
  CriticalError = 'critical_error',
  Pause = 'pause',
  Resume = 'resume',
}

export type TransitionMap = Partial<Record<AgentState, Partial<Record<AgentEvent, AgentState>>>>;

export const DEFAULT_TRANSITIONS: TransitionMap = {
  [AgentState.Idle]: {
    [AgentEvent.Tick]: AgentState.FetchingData,
  },
  [AgentState.FetchingData]: {
    [AgentEvent.DataFetched]: AgentState.GeneratingDecision,
    [AgentEvent.ExchangeError]: AgentState.Error,
    [AgentEvent.ExchangeUnauthorized]: AgentState.Paused,
  },
  [AgentState.GeneratingDecision]: {
    [AgentEvent.DecisionGenerated]: AgentState.Validating,
    [AgentEvent.DecisionTimeout]: AgentState.Waiting,
    [AgentEvent.ExchangeError]: AgentState.Error,
  },
  [AgentState.Validating]: {
    [AgentEvent.ValidationPassed]: AgentState.ComputingRisk,
    [AgentEvent.ValidationFailed]: AgentState.Idle,
  },
  [AgentState.ComputingRisk]: {
    [AgentEvent.RiskComputed]: AgentState.ApplyingGuardrails,
  },
  [AgentState.ApplyingGuardrails]: {
    [AgentEvent.GuardrailsPassed]: AgentState.Executing,
    [AgentEvent.GuardrailsRejected]: AgentState.Idle,
  },
  [AgentState.Executing]: {
    [AgentEvent.OrderPlaced]: AgentState.Idle,
    [AgentEvent.OrderFailed]: AgentState.Error,
    [AgentEvent.ExchangeError]: AgentState.Error,
    [AgentEvent.ExchangeUnauthorized]: AgentState.Paused,
  },
  [AgentState.Waiting]: {
    [AgentEvent.Tick]: AgentState.Idle,
  },
  [AgentState.Error]: {
    [AgentEvent.Tick]: AgentState.FetchingData,
    [AgentEvent.Pause]: AgentState.Paused,
  },
  [AgentState.Paused]: {
    [AgentEvent.Resume]: AgentState.Idle,
  },
};
