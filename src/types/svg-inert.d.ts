import 'react';

declare module 'react' {
  interface SVGAttributes<T> {
    inert?: boolean;
  }
}

declare global {
  interface SVGElement {
    inert: boolean;
  }
}
