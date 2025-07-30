class CreateClues < ActiveRecord::Migration[8.0]
  def change
    create_table :clues do |t|
      t.text :clue_text
      t.string :answer
      t.string :difficulty
      t.string :category

      t.timestamps
    end
  end
end
