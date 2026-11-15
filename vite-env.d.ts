/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const content: any;
  export default content;
}
