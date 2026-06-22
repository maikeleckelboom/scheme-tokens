export interface Issue<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
  readonly path?: string;
}

export type NonEmptyIssues<I> = readonly [I, ...I[]];

export type FailureResult<I extends Issue = Issue> = {
  readonly ok: false;
  readonly issues: NonEmptyIssues<I>;
};

export type Result<Value, I extends Issue = Issue> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | FailureResult<I>;

export function ok<Value>(value: Value): Result<Value, never> {
  return { ok: true, value };
}

export function fail<I extends Issue>(issues: NonEmptyIssues<I>): Result<never, I> {
  return { ok: false, issues };
}

export class IssueCollector<I extends Issue> {
  readonly #issues: I[] = [];

  add(issue: I): void {
    this.#issues.push(issue);
  }

  addMany(issues: readonly I[]): void {
    for (const issue of issues) {
      this.add(issue);
    }
  }

  get hasIssues(): boolean {
    return this.#issues.length > 0;
  }

  issues(): NonEmptyIssues<I> | undefined {
    return this.#issues.length === 0 ? undefined : (this.#issues as unknown as NonEmptyIssues<I>);
  }

  result<Value>(value: Value): Result<Value, I> {
    const issues = this.issues();
    return issues === undefined ? { ok: true, value } : { ok: false, issues };
  }
}
