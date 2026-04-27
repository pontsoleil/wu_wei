#!/usr/local/bin/awk -f
# Processing two files using awk
# see https://unix.stackexchange.com/questions/106645/processing-two-files-using-awk
# $ ./update.awk data/cgivars data/f99448e5-8cad-44e8-971b-278cb44b0f2d
{
# FNR is the line number of the current file, NR is the number of 
# lines that have been processed. If you only give one file to
# awk, FNR will always equal NR. If you give more than one file,
# FNR will go back to 1 when the next file is reached but NR
# will continue incrementing. Therefore, NR == FNR only while
# the first file is being processed.
  if (NR == FNR) {
    # If this is the first file, save the $2 values of $1
    # in the array vars.
    vars[$1]=$2; next
  }
  # If we have moved on to the 2nd file
  else {
    ## If the record of the second file having the same $1 value
    ## with the first file.
    if ($1 in vars) {
      # Replace the $2 value with the first file's value stored
      # in the array vars.
      print $1, vars[$1]
      # And clear the stored value not to be printed in END{} block.
      vars[$1]=0
    }
    else {
      # Otherwise print the whole record.
      print $0
    }
  }
}
## The END{} block is executed after all files have been processed.
## This is useful since you may have more than one line whose $1
## field was not in in the second file so you want to print new record
## in the first files.
END {
  for (i in vars) {
    if (0 != vars[i] && i != "$.id") {
      # Print "$.value.comment 説明" as "value.comment 説明"
      print substr(i, 3), vars[i]
    }
  }
}
# update.awk
