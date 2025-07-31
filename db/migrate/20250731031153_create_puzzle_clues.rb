class CreatePuzzleClues < ActiveRecord::Migration[8.0]
  def change
    create_table :puzzle_clues do |t|
      t.references :puzzle, null: false, foreign_key: true
      t.references :clue, null: false, foreign_key: true
      t.integer :number
      t.string :direction

      t.timestamps
    end
  end
end
