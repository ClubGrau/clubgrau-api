import morganLogger from 'morgan';

const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';

export const morgan = morganLogger(format);
