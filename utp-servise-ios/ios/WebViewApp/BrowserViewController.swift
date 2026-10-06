import UIKit
import WebKit

final class BrowserViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let errorLabel = UILabel()
    private let retryButton = UIButton(type: .system)
    private let errorStack = UIStackView()
    private var homeURL: URL?
    private var failedURL: URL?
    private lazy var backButton = UIBarButtonItem(title: "Назад", style: .plain, target: self, action: #selector(goBack))
    private lazy var forwardButton = UIBarButtonItem(title: "Вперёд", style: .plain, target: self, action: #selector(goForward))

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        spinner.hidesWhenStopped = true
        navigationItem.rightBarButtonItem = UIBarButtonItem(customView: spinner)
        toolbarItems = [backButton, forwardButton, UIBarButtonItem(systemItem: .flexibleSpace),
                        UIBarButtonItem(barButtonSystemItem: .refresh, target: self, action: #selector(reload))]
        navigationController?.setToolbarHidden(false, animated: false)
        errorLabel.numberOfLines = 0
        errorLabel.textAlignment = .center
        retryButton.setTitle("Повторить", for: .normal)
        retryButton.addTarget(self, action: #selector(reload), for: .touchUpInside)
        errorStack.axis = .vertical
        errorStack.spacing = 16
        errorStack.addArrangedSubview(errorLabel)
        errorStack.addArrangedSubview(retryButton)
        errorStack.translatesAutoresizingMaskIntoConstraints = false
        errorStack.isHidden = true
        view.addSubview(errorStack)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            errorStack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
            errorStack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            errorStack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24)
        ])
        updateNavigation()
        do {
            homeURL = try WebsiteConfiguration.load()
            reload()
        } catch {
            showError("Укажите корректный HTTPS-адрес сайта в config/mobile.json.")
            retryButton.isEnabled = false
        }
    }

    @objc private func goBack() { webView.goBack() }
    @objc private func goForward() { webView.goForward() }
    @objc private func reload() {
        guard let url = failedURL ?? webView.url ?? homeURL else { return }
        webView.load(URLRequest(url: url))
    }

    private func updateNavigation() {
        backButton.isEnabled = webView.canGoBack
        forwardButton.isEnabled = webView.canGoForward
    }

    private func showError(_ message: String) {
        spinner.stopAnimating()
        webView.isHidden = true
        errorLabel.text = message
        errorStack.isHidden = false
        updateNavigation()
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        errorStack.isHidden = true
        webView.isHidden = false
        spinner.startAnimating()
        updateNavigation()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        spinner.stopAnimating()
        failedURL = nil
        updateNavigation()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }

    private func handleFailure(_ error: Error) {
        let nativeError = error as NSError
        if nativeError.domain == NSURLErrorDomain && nativeError.code == NSURLErrorCancelled { return }
        if let url = nativeError.userInfo[NSURLErrorFailingURLErrorKey] as? URL, url.scheme == "https" {
            failedURL = url
        }
        showError("Не удалось загрузить страницу. Проверьте подключение и попробуйте снова.")
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        showError("Страница перестала отвечать. Попробуйте загрузить её снова.")
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "https" { decisionHandler(.allow); return }
        if ["tel", "mailto", "sms"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url, options: [:])
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, navigationAction.request.url?.scheme == "https" {
            webView.load(navigationAction.request)
        }
        return nil
    }
}
