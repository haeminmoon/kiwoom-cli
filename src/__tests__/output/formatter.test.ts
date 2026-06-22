import { output, getOutputFormat, outputTable } from '../../output/formatter';

describe('getOutputFormat', () => {
  it('returns json only when explicitly requested', () => {
    expect(getOutputFormat({ output: 'json' })).toBe('json');
    expect(getOutputFormat({ output: 'table' })).toBe('table');
    expect(getOutputFormat({})).toBe('table');
  });
});

describe('output', () => {
  let logSpy: jest.SpyInstance;
  let tableSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    tableSpy = jest.spyOn(console, 'table').mockImplementation(() => undefined);
  });
  afterEach(() => {
    logSpy.mockRestore();
    tableSpy.mockRestore();
  });

  it('prints JSON when format is json', () => {
    output({ a: 1 }, 'json');
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ a: 1 }, null, 2));
  });

  it('prints object key/values in table mode', () => {
    output({ stk_nm: '삼성전자', cur_prc: '-350000' }, 'table');
    const printed = logSpy.mock.calls.flat().join('\n');
    expect(printed).toContain('stk_nm');
    expect(printed).toContain('삼성전자');
  });

  it('uses console.table for arrays of objects', () => {
    output([{ a: 1 }, { a: 2 }], 'table');
    expect(tableSpy).toHaveBeenCalled();
  });

  it('prints "No data" for empty arrays', () => {
    output([], 'table');
    expect(logSpy).toHaveBeenCalledWith('No data');
  });

  it('prints "No data" for empty objects', () => {
    output({}, 'table');
    expect(logSpy).toHaveBeenCalledWith('No data');
  });

  it('prints primitives directly', () => {
    output('hello', 'table');
    expect(logSpy).toHaveBeenCalledWith('hello');
  });

  it('prints scalar arrays line by line', () => {
    output(['x', 'y'], 'table');
    const printed = logSpy.mock.calls.flat().join('\n');
    expect(printed).toContain('x');
    expect(printed).toContain('y');
  });
});

describe('outputTable', () => {
  let logSpy: jest.SpyInstance;
  let tableSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    tableSpy = jest.spyOn(console, 'table').mockImplementation(() => undefined);
  });
  afterEach(() => {
    logSpy.mockRestore();
    tableSpy.mockRestore();
  });

  it('emits JSON when requested', () => {
    outputTable([{ a: 1 }], 'json');
    expect(logSpy).toHaveBeenCalled();
    expect(tableSpy).not.toHaveBeenCalled();
  });

  it('emits a table otherwise', () => {
    outputTable([{ a: 1 }], 'table');
    expect(tableSpy).toHaveBeenCalled();
  });
});
