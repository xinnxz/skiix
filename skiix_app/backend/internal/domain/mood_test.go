package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMoodCatalog_ThreeFreeNinePro(t *testing.T) {
	assert.Len(t, BasePostMoods, 3)
	assert.Len(t, ExpandedPostMoods, 9)
	assert.Len(t, ValidPostMoods, 12)

	assert.True(t, IsBasePostMood("sad"))
	assert.True(t, IsBasePostMood("chill"))
	assert.True(t, IsBasePostMood("hype"))
	assert.True(t, IsBasePostMood("happy"))
	assert.True(t, IsBasePostMood("excited"))

	assert.False(t, IsBasePostMood("creative"))
	assert.True(t, IsExpandedPostMood("creative"))
	assert.Equal(t, MoodTierPlus, MoodTier("creative"))
	assert.Equal(t, MoodTierFree, MoodTier("sad"))
}
