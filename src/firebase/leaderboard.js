import { db } from './config';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

const leaderboardCollection = collection(db, 'leaderboard');

export async function saveScore(playerName, score) {
    try {
        await addDoc(leaderboardCollection, {
            playerName,
            score,
            date: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error saving score: ", error);
        return false;
    }
}

export async function getTopScores(limitCount = 10) {
    try {
        const q = query(leaderboardCollection, orderBy('score', 'desc'), limit(limitCount));
        const querySnapshot = await getDocs(q);
        const scores = [];
        querySnapshot.forEach((doc) => {
            scores.push({ id: doc.id, ...doc.data() });
        });
        return scores;
    } catch (error) {
        console.error("Error getting scores: ", error);
        return [];
    }
}
