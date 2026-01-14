/**
 * @purpose   環境値（stage→account/region）の一元管理を行う
 * @stack     全スタック共通
 * @overview  Stack/Construct からは本マップのみを参照し、ハードコードを禁止する
 */
export const envs = {
  sbx: { account: '111111111111', region: 'ap-northeast-1' },
  dev: { account: '222222222222', region: 'ap-northeast-1' },
  stg: { account: '333333333333', region: 'ap-northeast-1' },
  prod: { account: '444444444444', region: 'ap-northeast-1' }
} as const;

export type Stage = keyof typeof envs;

export const defaultStage: Stage = 'dev';

/**
 * リージョン短縮名（命名規則用）。必要に応じて拡張。
 */
export const shortRegion = (region: string): string => {
  switch (region) {
    case 'ap-northeast-1':
      return 'an1';
    case 'ap-northeast-3':
      return 'an3';
    default:
      return region.replace(/[^a-z0-9]/g, '').slice(0, 3);
  }
};
