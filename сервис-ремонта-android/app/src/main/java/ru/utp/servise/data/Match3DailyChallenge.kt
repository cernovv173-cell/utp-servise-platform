package ru.utp.servise.data

import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class Match3Position(val row: Int, val column: Int)

object Match3DailyChallenge {
    private val moscowZone = ZoneId.of("Europe/Moscow")
    private val tileKinds = listOf(
        "case", "motherboard", "processor", "cooling", "gpu", "ssd", "ram", "power",
    )

    fun dayKey(clock: Clock = Clock.systemUTC()): String =
        LocalDate.now(clock.withZone(moscowZone)).format(DateTimeFormatter.ISO_LOCAL_DATE)

    fun createBoard(dayKey: String): List<List<Match3Tile>> {
        val seed = dayKey.fold(7L) { value, character ->
            (value * 31L + character.code) and 0xFFFF_FFFFL
        }
        val board = List(8) { row ->
            List(8) { column ->
                val kindIndex = ((seed + row + column) % tileKinds.size).toInt()
                Match3Tile(tileKinds[kindIndex], frozen = false, junk = false, anomalyTurns = null)
            }
        }.map { it.toMutableList() }
        val matchKind = board[0][0].kind
        board[0][2] = board[0][2].copy(kind = matchKind)
        board[1][1] = board[1][1].copy(kind = matchKind)
        return board.map { it.toList() }
    }

    fun hasLine(board: List<List<Match3Tile>>): Boolean {
        for (row in board) {
            for (column in 0..row.size - 3) {
                val kind = row[column].kind
                if (kind != null && kind == row[column + 1].kind && kind == row[column + 2].kind) return true
            }
        }

        val columnCount = board.maxOfOrNull { it.size } ?: 0
        for (column in 0 until columnCount) {
            for (row in 0..board.size - 3) {
                val kind = board[row].getOrNull(column)?.kind
                if (
                    kind != null &&
                    kind == board[row + 1].getOrNull(column)?.kind &&
                    kind == board[row + 2].getOrNull(column)?.kind
                ) return true
            }
        }
        return false
    }

    fun isSuccessfulMove(
        sourceBoard: List<List<Match3Tile>>,
        from: Match3Position,
        to: Match3Position,
    ): Boolean {
        val adjacent = kotlin.math.abs(from.row - to.row) + kotlin.math.abs(from.column - to.column) == 1
        if (!adjacent || !sourceBoard.isInside(from) || !sourceBoard.isInside(to)) return false

        val board = sourceBoard.map { it.toMutableList() }
        val first = board[from.row][from.column]
        val second = board[to.row][to.column]
        if (first.frozen || first.junk || second.frozen || second.junk || first.kind == null || second.kind == null) {
            return false
        }

        board[from.row][from.column] = second
        board[to.row][to.column] = first
        return hasLine(board)
    }

    private fun List<List<Match3Tile>>.isInside(position: Match3Position): Boolean =
        position.row in indices && position.column in this[position.row].indices
}
