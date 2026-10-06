package com.example.webviewapp;

import android.graphics.Bitmap;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

final class BrowserClient extends WebViewClient {
    private final MainActivity activity;
    BrowserClient(MainActivity activity) { this.activity = activity; }

    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return activity.handleNavigation(request.getUrl());
    }
    @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
        activity.beginNavigation();
    }
    @Override public void onPageFinished(WebView view, String url) { activity.finishNavigation(); }
    @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) activity.showError(R.string.load_error);
    }
    @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
        if (request.isForMainFrame()) activity.showError(R.string.load_error);
    }
}
