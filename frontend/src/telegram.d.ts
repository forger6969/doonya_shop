interface Window {
  Telegram?: {
    WebApp: {
      ready(): void;
      expand(): void;
      initData: string;
      showAlert(message: string): void;
    };
  };
}
