package ru.utp.servise.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint

internal data class OrderPaperworkPdfSection(
    val title: String,
    val lines: List<String>,
)

internal fun saveOrderPaperworkPdf(
    context: Context,
    uri: Uri,
    serviceNumber: String,
    sections: List<OrderPaperworkPdfSection>,
) {
    val document = PdfDocument()
    val pageWidth = 595
    val pageHeight = 842
    val margin = 46f
    val contentWidth = (pageWidth - margin * 2).toInt()
    val bottom = pageHeight - 54f
    val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xff153d70.toInt()
        textSize = 20f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val sectionPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xff153d70.toInt()
        textSize = 15f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val bodyPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xff172033.toInt()
        textSize = 11f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
    }
    val footerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xff64748b.toInt()
        textSize = 9f
    }
    var pageNumber = 0
    var page: PdfDocument.Page? = null
    var canvas: Canvas? = null
    var y = 0f

    fun startPage() {
        pageNumber += 1
        val next = document.startPage(
            PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create(),
        )
        page = next
        canvas = next.canvas
        y = margin
        if (pageNumber == 1) {
            drawWrapped(canvas!!, "Документы по заявке $serviceNumber", titlePaint, margin, y, contentWidth)
            y += 38f
        }
    }

    fun finishPage() {
        val current = page ?: return
        canvas!!.drawText("Сервисный номер $serviceNumber · страница $pageNumber", margin, pageHeight - 24f, footerPaint)
        document.finishPage(current)
        page = null
        canvas = null
    }

    fun ensureRoom(height: Float) {
        if (page == null) startPage()
        if (y + height > bottom && y > margin + 5f) {
            finishPage()
            startPage()
        }
    }

    fun drawBlock(text: String, paint: TextPaint, spacing: Float = 8f) {
        val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, contentWidth)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setIncludePad(false)
            .build()
        ensureRoom(layout.height + spacing)
        canvas!!.save()
        canvas!!.translate(margin, y)
        layout.draw(canvas!!)
        canvas!!.restore()
        y += layout.height + spacing
    }

    try {
        startPage()
        sections.forEach { section ->
            ensureRoom(30f)
            drawBlock(section.title, sectionPaint, 8f)
            section.lines.forEach { line -> drawBlock(line, bodyPaint) }
            y += 8f
        }

        finishPage()
        context.contentResolver.openOutputStream(uri)?.use(document::writeTo)
            ?: error("Не удалось открыть файл для сохранения PDF.")
    } finally {
        page?.let(document::finishPage)
        document.close()
    }
}

private fun drawWrapped(
    canvas: Canvas,
    text: String,
    paint: TextPaint,
    x: Float,
    y: Float,
    width: Int,
) {
    val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
        .setAlignment(Layout.Alignment.ALIGN_NORMAL)
        .setIncludePad(false)
        .build()
    canvas.save()
    canvas.translate(x, y)
    layout.draw(canvas)
    canvas.restore()
}
