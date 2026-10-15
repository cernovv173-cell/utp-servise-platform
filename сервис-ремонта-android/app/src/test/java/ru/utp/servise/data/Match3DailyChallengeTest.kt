package ru.utp.servise.data

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class Match3DailyChallengeTest {
    @Test
    fun `daily reset follows Moscow calendar date`() {
        val beforeMidnight = Clock.fixed(Instant.parse("2026-10-15T20:30:00Z"), ZoneOffset.UTC)
        val afterMidnight = Clock.fixed(Instant.parse("2026-10-15T21:30:00Z"), ZoneOffset.UTC)

        assertEquals("2026-10-15", Match3DailyChallenge.dayKey(beforeMidnight))
        assertEquals("2026-10-16", Match3DailyChallenge.dayKey(afterMidnight))
    }

    @Test
    fun `daily board is repeatable and starts without a free line`() {
        val board = Match3DailyChallenge.createBoard("2026-10-15")

        assertEquals(board, Match3DailyChallenge.createBoard("2026-10-15"))
        assertFalse(Match3DailyChallenge.hasLine(board))
        assertTrue(
            Match3DailyChallenge.isSuccessfulMove(
                board,
                Match3Position(0, 1),
                Match3Position(1, 1),
            ),
        )
    }

    @Test
    fun `daily boards remain solvable across the calendar year`() {
        val start = LocalDate.parse("2026-01-01")

        for (day in 0 until 365) {
            val board = Match3DailyChallenge.createBoard(start.plusDays(day.toLong()).toString())
            assertFalse("Unexpected starting match on day $day", Match3DailyChallenge.hasLine(board))
            assertTrue(
                "Missing solution on day $day",
                Match3DailyChallenge.isSuccessfulMove(
                    board,
                    Match3Position(0, 1),
                    Match3Position(1, 1),
                ),
            )
        }
    }

    @Test
    fun `daily puzzle rejects invalid swaps without changing its board`() {
        val board = Match3DailyChallenge.createBoard("2026-10-15")

        assertFalse(Match3DailyChallenge.isSuccessfulMove(board, Match3Position(0, 0), Match3Position(2, 0)))
        assertFalse(Match3DailyChallenge.isSuccessfulMove(board, Match3Position(-1, 0), Match3Position(0, 0)))
        assertFalse(Match3DailyChallenge.hasLine(board))
    }
}
