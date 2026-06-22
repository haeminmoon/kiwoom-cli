import {
  ActionableError,
  KiwoomApiError,
  handleError,
  requireConfig,
} from '../../output/error';

describe('ActionableError', () => {
  it('carries a suggested command', () => {
    const err = new ActionableError('boom', 'kiwoom-cli config init');
    expect(err.message).toBe('boom');
    expect(err.suggestedCommand).toBe('kiwoom-cli config init');
    expect(err.name).toBe('ActionableError');
  });
});

describe('KiwoomApiError', () => {
  it('formats code + message', () => {
    const err = new KiwoomApiError(2, '입력 값 오류입니다', 'ka10001');
    expect(err.returnCode).toBe(2);
    expect(err.returnMsg).toBe('입력 값 오류입니다');
    expect(err.apiId).toBe('ka10001');
    expect(err.message).toContain('입력 값 오류입니다');
  });
});

describe('handleError', () => {
  let exitSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('__exit__');
    }) as never);
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('prints ActionableError with a Try hint', () => {
    expect(() =>
      handleError(new ActionableError('nope', 'kiwoom-cli config set --appkey X')),
    ).toThrow('__exit__');
    const output = errSpy.mock.calls.flat().join('\n');
    expect(output).toContain('nope');
    expect(output).toContain('Try: kiwoom-cli config set --appkey X');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('suggests config init for auth-related Kiwoom errors', () => {
    expect(() =>
      handleError(new KiwoomApiError(3, '유효하지 않은 토큰입니다', 'ka10001')),
    ).toThrow('__exit__');
    const output = errSpy.mock.calls.flat().join('\n');
    expect(output).toContain('config init');
  });

  it('handles plain errors', () => {
    expect(() => handleError(new Error('generic failure'))).toThrow('__exit__');
    const output = errSpy.mock.calls.flat().join('\n');
    expect(output).toContain('generic failure');
  });

  it('handles unknown throwables', () => {
    expect(() => handleError('weird')).toThrow('__exit__');
    expect(errSpy).toHaveBeenCalled();
  });
});

describe('requireConfig', () => {
  it('throws ActionableError when value missing', () => {
    expect(() => requireConfig(undefined, 'App key', '--appkey <key>')).toThrow(
      ActionableError,
    );
  });
  it('passes through when present', () => {
    expect(() => requireConfig('x', 'App key', '--appkey <key>')).not.toThrow();
  });
});
