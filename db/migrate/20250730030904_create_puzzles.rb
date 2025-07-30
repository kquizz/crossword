class CreatePuzzles < ActiveRecord::Migration[8.0]
  def change
    create_table :puzzles do |t|
      t.string :title
      t.text :description
      t.text :solution_grid
      t.text :blank_grid
      t.integer :width
      t.integer :height
      t.string :difficulty
      t.boolean :published

      t.timestamps
    end
  end
end
