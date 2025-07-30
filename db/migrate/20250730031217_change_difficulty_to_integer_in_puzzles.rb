class ChangeDifficultyToIntegerInPuzzles < ActiveRecord::Migration[8.0]
  def up
    change_column :puzzles, :difficulty, :integer
  end

  def down
    change_column :puzzles, :difficulty, :string
  end
end
